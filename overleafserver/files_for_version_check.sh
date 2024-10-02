docker exec -it overleafserver bash -ce "mkdir /var/lib/overleaf/to_mod"
docker exec -it overleafserver bash -ce "cp /overleaf/services/web/app/src/Features/Project/ProjectEditorHandler.js /var/lib/overleaf/to_mod"
docker exec -it overleafserver bash -ce "cp /overleaf/services/web/modules/track-changes/app/src/TrackChangesController.js /var/lib/overleaf/to_mod"
docker exec -it overleafserver bash -ce "cp /overleaf/services/web/modules/track-changes/app/src/TrackChangesRouter.js /var/lib/overleaf/to_mod"
docker exec -it overleafserver bash -ce "cp /overleaf/services/web/modules/track-changes/index.js /var/lib/overleaf/to_mod"
docker exec -it overleafserver bash -ce "cp /overleaf/services/clsi/app/js/LatexRunner.js /var/lib/overleaf/to_mod"
docker exec -it overleafserver bash -ce "cp /overleaf/services/web/modules/ldap-authentication/app/src/AuthenticationControllerLdap.js /var/lib/overleaf/to_mod"
docker exec -it overleafserver bash -ce "cp /overleaf/services/web/modules/ldap-authentication/app/src/AuthenticationManagerLdap.js /var/lib/overleaf/to_mod"
docker exec -it overleafserver bash -ce "cp /overleaf/services/web/modules/ldap-authentication/app/src/InitLdapAuthentication.js /var/lib/overleaf/to_mod"
docker exec -it overleafserver bash -ce "cp /overleaf/services/web/modules/ldap-authentication/app/src/LdapContacts.js /var/lib/overleaf/to_mod"
docker exec -it overleafserver bash -ce "cp /overleaf/services/web/modules/ldap-authentication/app/src/LdapStrategy.js /var/lib/overleaf/to_mod"
docker exec -it overleafserver bash -ce "cp /overleaf/services/web/modules/ldap-authentication/index.js /var/lib/overleaf/to_mod"
docker exec -it overleafserver bash -ce "cp /overleaf/services/web/app/src/Features/Authentication/AuthenticationController.js /var/lib/overleaf/to_mod" 
docker exec -it overleafserver bash -ce "cp /overleaf/services/web/app/src/Features/PasswordReset/PasswordResetController.js /var/lib/overleaf/to_mod"
docker exec -it overleafserver bash -ce "cp /overleaf/services/web/app/src/Features/PasswordReset/PasswordResetHandler.js /var/lib/overleaf/to_mod"
docker exec -it overleafserver bash -ce "cp /overleaf/services/web/app/src/Features/User/UserController.js /var/lib/overleaf/to_mod"
docker exec -it overleafserver bash -ce "cp /overleaf/services/web/app/src/infrastructure/Features.js /var/lib/overleaf/to_mod"
docker exec -it overleafserver bash -ce "cp /overleaf/services/web/app/views/user/login.pug /var/lib/overleaf/to_mod"
docker exec -it overleafserver bash -ce "cp /overleaf/services/web/config/settings.defaults.js /var/lib/overleaf/to_mod"
docker exec -it overleafserver bash -ce "cp /overleaf/services/web/frontend/js/features/ide-react/context/review-panel/hooks/use-review-panel-state.ts /var/lib/overleaf/to_mod"
docker exec -it overleafserver bash -ce "cp /overleaf/services/web/frontend/js/features/source-editor/hooks/use-codemirror-scope.ts /var/lib/overleaf/to_mod"
docker exec -it overleafserver bash -ce "cp /overleaf/services/web/locales/en.json /var/lib/overleaf/to_mod"
docker exec -it overleafserver bash -ce "cp /overleaf/services/web/modules/launchpad/app/src/LaunchpadController.js /var/lib/overleaf/to_mod"
docker exec -it overleafserver bash -ce "cp /overleaf/services/web/modules/launchpad/app/views/launchpad.pug /var/lib/overleaf/to_mod"
docker exec -it overleafserver bash -ce "cp /overleaf/patches/ldapauth-fork+4.3.3.patch /var/lib/overleaf/to_mod"
