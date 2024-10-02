const AuthenticationManager = require('./AuthenticationManager')
const SessionManager = require('./SessionManager')
const OError = require('@overleaf/o-error')
const LoginRateLimiter = require('../Security/LoginRateLimiter')
const UserUpdater = require('../User/UserUpdater')
const Metrics = require('@overleaf/metrics')
const logger = require('@overleaf/logger')
const querystring = require('querystring')
const Settings = require('@overleaf/settings')
const basicAuth = require('basic-auth')
const tsscmp = require('tsscmp')
const UserHandler = require('../User/UserHandler')
const UserSessionsManager = require('../User/UserSessionsManager')
const Analytics = require('../Analytics/AnalyticsManager')
const passport = require('passport')
const NotificationsBuilder = require('../Notifications/NotificationsBuilder')
const UrlHelper = require('../Helpers/UrlHelper')
const AsyncFormHelper = require('../Helpers/AsyncFormHelper')
const _ = require('lodash')
const UserAuditLogHandler = require('../User/UserAuditLogHandler')
const AnalyticsRegistrationSourceHelper = require('../Analytics/AnalyticsRegistrationSourceHelper')
const {
  acceptsJson,
} = require('../../infrastructure/RequestContentTypeDetection')
const {
  ParallelLoginError,
  PasswordReusedError,
} = require('./AuthenticationErrors')
const { hasAdminAccess } = require('../Helpers/AdminAuthorizationHelper')
const Modules = require('../../infrastructure/Modules')
const { expressify, promisify } = require('@overleaf/promise-utils')

function send401WithChallenge(res) {
  res.setHeader('WWW-Authenticate', 'OverleafLogin')
  res.sendStatus(401)
}

function checkCredentials(userDetailsMap, user, password) {
  const expectedPassword = userDetailsMap.get(user)
  const userExists = userDetailsMap.has(user) && expectedPassword // user exists with a non-null password
  const isValid = userExists && tsscmp(expectedPassword, password)
  if (!isValid) {
    logger.err({ user }, 'invalid login details')
  }
  Metrics.inc('security.http-auth.check-credentials', 1, {
    path: userExists ? 'known-user' : 'unknown-user',
    status: isValid ? 'pass' : 'fail',
  })
  return isValid
}

function reduceStaffAccess(staffAccess) {
  const reducedStaffAccess = {}
  for (const field in staffAccess) {
    if (staffAccess[field]) {
      reducedStaffAccess[field] = true
    }
  }
  return reducedStaffAccess
}

function userHasStaffAccess(user) {
  return user.staffAccess && Object.values(user.staffAccess).includes(true)
}

// TODO: Finish making these methods async
const AuthenticationController = {
  serializeUser(user, callback) {
    if (!user._id || !user.email) {
      const err = new Error('serializeUser called with non-user object')
      logger.warn({ user }, err.message)
      return callback(err)
    }
    const lightUser = {
      _id: user._id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      referal_id: user.referal_id,
      session_created: new Date().toISOString(),
      ip_address: user._login_req_ip,
      must_reconfirm: user.must_reconfirm,
      v1_id: user.overleaf != null ? user.overleaf.id : undefined,
      analyticsId: user.analyticsId || user._id,
      alphaProgram: user.alphaProgram || undefined, // only store if set
      betaProgram: user.betaProgram || undefined, // only store if set
    }
    if (user.isAdmin) {
      lightUser.isAdmin = true
    }
    if (userHasStaffAccess(user)) {
      lightUser.staffAccess = reduceStaffAccess(user.staffAccess)
    }

    callback(null, lightUser)
  },

  deserializeUser(user, cb) {
    cb(null, user)
  },

  passportLogin(req, res, next) {
    // This function is middleware which wraps the passport.authenticate middleware,
    // so we can send back our custom `{message: {text: "", type: ""}}` responses on failure,
    // and send a `{redir: ""}` response on success
    passport.authenticate(
      Settings.ldap?.enable ? ['custom-fail-ldapauth','local'] : ['local'],
      { keepSessionInfo: true },
      function (err, user, infoArray) {
        if (err) {
          return next(err)
        }
        if (user) {
          // `user` is either a user object or false
          AuthenticationController.setAuditInfo(req, {
            method: 'Password login',
          })
          return AuthenticationController.finishLogin(user, req, res, next)
        } else {
          let info = infoArray[0]
          if (info.redir != null) {
            return res.json({ redir: info.redir })
          } else {
            res.status(info.status || 200)
            delete info.status
            const body = { message: info }
            const { errorReason } = info
            if (errorReason) {
              body.errorReason = errorReason
              delete info.errorReason
            }
            return res.json(body)
          }
        }
      }
    )(req, res, next)
  },

  async _finishLoginAsync(user, req, res) {
    if (user === false) {
      return AsyncFormHelper.redirect(req, res, '/login')
    } // OAuth2 'state' mismatch

    if (user.suspended) {
      return AsyncFormHelper.redirect(req, res, '/account-suspended')
    }

    if (Settings.adminOnlyLogin && !hasAdminAccess(user)) {
      return res.status(403).json({
        message: { type: 'error', text: 'Admin only panel' },
      })
    }

    const auditInfo = AuthenticationController.getAuditInfo(req)

    const anonymousAnalyticsId = req.session.analyticsId
    const isNewUser = req.session.justRegistered || false

    const results = await Modules.promises.hooks.fire(
      'preFinishLogin',
      req,
      res,
      user
    )

    if (results.some(result => result && result.doNotFinish)) {
      return
    }

    if (user.must_reconfirm) {
      return AuthenticationController._redirectToReconfirmPage(req, res, user)
    }

    const redir =
      AuthenticationController.getRedirectFromSession(req) || '/project'

    _loginAsyncHandlers(req, user, anonymousAnalyticsId, isNewUser)
    const userId = user._id

    await UserAuditLogHandler.promises.addEntry(
      userId,
      'login',
      userId,
      req.ip,
      auditInfo
    )

    await _afterLoginSessionSetupAsync(req, user)

    AuthenticationController._clearRedirectFromSession(req)
    AnalyticsRegistrationSourceHelper.clearSource(req.session)
    AnalyticsRegistrationSourceHelper.clearInbound(req.session)
    AsyncFormHelper.redirect(req, res, redir)
  },

  finishLogin(user, req, res, next) {
    AuthenticationController._finishLoginAsync(user, req, res).catch(err =>
      next(err)
    )
  },

  doPassportLogin(req, username, password, done) {
    const email = username.toLowerCase()
    Modules.hooks.fire(
      'preDoPassportLogin',
      req,
      email,
      function (err, infoList) {
        if (err) {
          return done(err)
        }
        const info = infoList.find(i => i != null)
        if (info != null) {
          return done(null, false, info)
        }
        LoginRateLimiter.processLoginRequest(email, function (err, isAllowed) {
          if (err) {
            return done(err)
          }
          if (!isAllowed) {
            logger.debug({ email }, 'too many login requests')
            return done(null, null, {
              text: req.i18n.translate('to_many_login_requests_2_mins'),
              type: 'error',
              key: 'to-many-login-requests-2-mins',
              status: 429,
            })
          }
          const { fromKnownDevice } = AuthenticationController.getAuditInfo(req)
          const auditLog = {
            ipAddress: req.ip,
            info: { method: 'Password login', fromKnownDevice },
          }
          AuthenticationManager.authenticate(
            { email },
            password,
            auditLog,
            {
              enforceHIBPCheck: !fromKnownDevice,
            },
            function (error, user, isPasswordReused) {
              if (error != null) {
                if (error instanceof ParallelLoginError) {
                  return done(null, false, { status: 429 })
                } else if (error instanceof PasswordReusedError) {
                  const text = `${req.i18n
                    .translate(
                      'password_compromised_try_again_or_use_known_device_or_reset'
                    )
                    .replace('<0>', '')
                    .replace('</0>', ' (https://haveibeenpwned.com/passwords)')
                    .replace('<1>', '')
                    .replace(
                      '</1>',
                      ` (${Settings.siteUrl}/user/password/reset)`
                    )}.`
                  return done(null, false, {
                    status: 400,
                    type: 'error',
                    key: 'password-compromised',
                    text,
                  })
                }
                return done(error)
              }
              if (
                user &&
                AuthenticationController.captchaRequiredForLogin(req, user)
              ) {
                done(null, false, {
                  text: req.i18n.translate('cannot_verify_user_not_robot'),
                  type: 'error',
                  errorReason: 'cannot_verify_user_not_robot',
                  status: 400,
                })
              } else if (user) {
                if (
                  isPasswordReused &&
                  AuthenticationController.getRedirectFromSession(req) == null
                ) {
                  AuthenticationController.setRedirectInSession(
                    req,
                    '/compromised-password'
                  )
                }

                // async actions
                done(null, user)
              } else {
                AuthenticationController._recordFailedLogin()
                logger.debug({ email }, 'failed log in')
                done(null, false, {
                  type: 'error',
                  key: 'invalid-password-retry-or-reset',
                  status: 401,
                })
              }
            }
          )
        })
      }
    )
  },

  captchaRequiredForLogin(req, user) {
    switch (AuthenticationController.getAuditInfo(req).captcha) {
      case 'trusted':
      case 'disabled':
        return false
      case 'solved':
        return false
      case 'skipped': {
        let required = false
        if (user.lastFailedLogin) {
          const requireCaptchaUntil =
            user.lastFailedLogin.getTime() +
            Settings.elevateAccountSecurityAfterFailedLogin
          required = requireCaptchaUntil >= Date.now()
        }
        Metrics.inc('force_captcha_on_login', 1, {
          status: required ? 'yes' : 'no',
        })
        return required
      }
      default:
        throw new Error('captcha middleware missing in handler chain')
    }
  },

  ipMatchCheck(req, user) {
    if (req.ip !== user.lastLoginIp) {
      NotificationsBuilder.ipMatcherAffiliation(user._id).create(
        req.ip,
        () => {}
      )
    }
    return UserUpdater.updateUser(
      user._id.toString(),
      {
        $set: { lastLoginIp: req.ip },
      },
      () => {}
    )
  },

  requireLogin() {
    const doRequest = function (req, res, next) {
      if (next == null) {
        next = function () {}
      }
      if (!SessionManager.isUserLoggedIn(req.session)) {
        if (acceptsJson(req)) return send401WithChallenge(res)
        return AuthenticationController._redirectToLoginOrRegisterPage(req, res)
      } else {
        req.user = SessionManager.getSessionUser(req.session)
        return next()
      }
    }

    return doRequest
  },

  /**
   * @param {string} scope
   * @return {import('express').Handler}
   */
  requireOauth(scope) {
    if (typeof scope !== 'string' || !scope) {
      throw new Error(
        "requireOauth() expects a non-empty string as 'scope' parameter"
      )
    }

    // require this here because module may not be included in some versions
    const Oauth2Server = require('../../../../modules/oauth2-server/app/src/Oauth2Server')
    const middleware = async (req, res, next) => {
      const request = new Oauth2Server.Request(req)
      const response = new Oauth2Server.Response(res)
      try {
        const token = await Oauth2Server.server.authenticate(
          request,
          response,
          { scope }
        )
        req.oauth = { access_token: token.accessToken }
        req.oauth_token = token
        req.oauth_user = token.user
        next()
      } catch (err) {
        if (
          err.code === 400 &&
          err.message === 'Invalid request: malformed authorization header'
        ) {
          err.code = 401
        }
        // send all other errors
        res
          .status(err.code)
          .json({ error: err.name, error_description: err.message })
      }
    }
    return expressify(middleware)
  },

  _globalLoginWhitelist: [],
  addEndpointToLoginWhitelist(endpoint) {
    return AuthenticationController._globalLoginWhitelist.push(endpoint)
  },

  requireGlobalLogin(req, res, next) {
    if (
      AuthenticationController._globalLoginWhitelist.includes(
        req._parsedUrl.pathname
      )
    ) {
      return next()
    }

    if (req.headers.authorization != null) {
      AuthenticationController.requirePrivateApiAuth()(req, res, next)
    } else if (SessionManager.isUserLoggedIn(req.session)) {
      next()
    } else {
      logger.debug(
        { url: req.url },
        'user trying to access endpoint not in global whitelist'
      )
      if (acceptsJson(req)) return send401WithChallenge(res)
      AuthenticationController.setRedirectInSession(req)
      res.redirect('/login')
    }
  },

  validateAdmin(req, res, next) {
    const adminDomains = Settings.adminDomains
    if (
      !adminDomains ||
      !(Array.isArray(adminDomains) && adminDomains.length)
    ) {
      return next()
    }
    const user = SessionManager.getSessionUser(req.session)
    if (!hasAdminAccess(user)) {
      return next()
    }
    const email = user.email
    if (email == null) {
      return next(
        new OError('[ValidateAdmin] Admin user without email address', {
          userId: user._id,
        })
      )
    }
    if (!adminDomains.find(domain => email.endsWith(`@${domain}`))) {
      return next(
        new OError('[ValidateAdmin] Admin user with invalid email domain', {
          email,
          userId: user._id,
        })
      )
    }
    return next()
  },

  checkCredentials,

  requireBasicAuth: function (userDetails) {
    const userDetailsMap = new Map(Object.entries(userDetails))
    return function (req, res, next) {
      const credentials = basicAuth(req)
      if (
        !credentials ||
        !checkCredentials(userDetailsMap, credentials.name, credentials.pass)
      ) {
        send401WithChallenge(res)
        Metrics.inc('security.http-auth', 1, { status: 'reject' })
      } else {
        Metrics.inc('security.http-auth', 1, { status: 'accept' })
        next()
      }
    }
  },

  requirePrivateApiAuth() {
    return AuthenticationController.requireBasicAuth(Settings.httpAuthUsers)
  },

  setAuditInfo(req, info) {
    if (!req.__authAuditInfo) {
      req.__authAuditInfo = {}
    }
    Object.assign(req.__authAuditInfo, info)
  },

  getAuditInfo(req) {
    return req.__authAuditInfo || {}
  },

  setRedirectInSession(req, value) {
    if (value == null) {
      value =
        Object.keys(req.query).length > 0
          ? `${req.path}?${querystring.stringify(req.query)}`
          : `${req.path}`
    }
    if (
      req.session != null &&
      !/^\/(socket.io|js|stylesheets|img)\/.*$/.test(value) &&
      !/^.*\.(png|jpeg|svg)$/.test(value)
    ) {
      const safePath = UrlHelper.getSafeRedirectPath(value)
      return (req.session.postLoginRedirect = safePath)
    }
  },

  _redirectToLoginOrRegisterPage(req, res) {
    if (
      req.query.zipUrl != null ||
      req.session.sharedProjectData ||
      req.path === '/user/subscription/new'
    ) {
      AuthenticationController._redirectToRegisterPage(req, res)
    } else {
      AuthenticationController._redirectToLoginPage(req, res)
    }
  },

  _redirectToLoginPage(req, res) {
    logger.debug(
      { url: req.url },
      'user not logged in so redirecting to login page'
    )
    AuthenticationController.setRedirectInSession(req)
    const url = `/login?${querystring.stringify(req.query)}`
    res.redirect(url)
    Metrics.inc('security.login-redirect')
  },

  _redirectToReconfirmPage(req, res, user) {
    logger.debug(
      { url: req.url },
      'user needs to reconfirm so redirecting to reconfirm page'
    )
    req.session.reconfirm_email = user != null ? user.email : undefined
    const redir = '/user/reconfirm'
    AsyncFormHelper.redirect(req, res, redir)
  },

  _redirectToRegisterPage(req, res) {
    logger.debug(
      { url: req.url },
      'user not logged in so redirecting to register page'
    )
    AuthenticationController.setRedirectInSession(req)
    const url = `/register?${querystring.stringify(req.query)}`
    res.redirect(url)
    Metrics.inc('security.login-redirect')
  },

  _recordSuccessfulLogin(userId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    UserUpdater.updateUser(
      userId.toString(),
      {
        $set: { lastLoggedIn: new Date() },
        $inc: { loginCount: 1 },
      },
      function (error) {
        if (error != null) {
          callback(error)
        }
        Metrics.inc('user.login.success')
        callback()
      }
    )
  },

  _recordFailedLogin(callback) {
    Metrics.inc('user.login.failed')
    if (callback) callback()
  },

  getRedirectFromSession(req) {
    let safePath
    const value = _.get(req, ['session', 'postLoginRedirect'])
    if (value) {
      safePath = UrlHelper.getSafeRedirectPath(value)
    }
    return safePath || null
  },

  _clearRedirectFromSession(req) {
    if (req.session != null) {
      delete req.session.postLoginRedirect
    }
  },
}

function _afterLoginSessionSetup(req, user, callback) {
  req.login(user, { keepSessionInfo: true }, function (err) {
    if (err) {
      OError.tag(err, 'error from req.login', {
        user_id: user._id,
      })
      return callback(err)
    }
    delete req.session.__tmp
    delete req.session.csrfSecret
    req.session.save(function (err) {
      if (err) {
        OError.tag(err, 'error saving regenerated session after login', {
          user_id: user._id,
        })
        return callback(err)
      }
      UserSessionsManager.trackSession(user, req.sessionID, function () {})
      if (!req.deviceHistory) {
        // Captcha disabled or SSO-based login.
        return callback()
      }
      req.deviceHistory.add(user.email)
      req.deviceHistory
        .serialize(req.res)
        .catch(err => {
          logger.err({ err }, 'cannot serialize deviceHistory')
        })
        .finally(() => callback())
    })
  })
}

const _afterLoginSessionSetupAsync = promisify(_afterLoginSessionSetup)

function _loginAsyncHandlers(req, user, anonymousAnalyticsId, isNewUser) {
  UserHandler.setupLoginData(user, err => {
    if (err != null) {
      logger.warn({ err }, 'error setting up login data')
    }
  })
  LoginRateLimiter.recordSuccessfulLogin(user.email, () => {})
  AuthenticationController._recordSuccessfulLogin(user._id, () => {})
  AuthenticationController.ipMatchCheck(req, user)
  Analytics.recordEventForUserInBackground(user._id, 'user-logged-in', {
    source: req.session.saml
      ? 'saml'
      : req.user_info?.auth_provider || 'email-password',
  })
  Analytics.identifyUser(user._id, anonymousAnalyticsId, isNewUser)

  logger.debug(
    { email: user.email, userId: user._id.toString() },
    'successful log in'
  )

  req.session.justLoggedIn = true
  // capture the request ip for use when creating the session
  return (user._login_req_ip = req.ip)
}

AuthenticationController.promises = {
  finishLogin: AuthenticationController._finishLoginAsync,
}

module.exports = AuthenticationController
