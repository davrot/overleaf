const logger = require('@overleaf/logger')
const AuthorizationMiddleware = require('../../../../app/src/Features/Authorization/AuthorizationMiddleware')
const TrackChangesController = require('./TrackChangesController')

module.exports = {
  apply(webRouter) {
    logger.debug({}, 'Init track-changes router')

    webRouter.post('/project/:project_id/track_changes',
      AuthorizationMiddleware.blockRestrictedUserFromProject,
      AuthorizationMiddleware.ensureUserCanReadProject,
      TrackChangesController.trackChanges
    )
    webRouter.post('/project/:project_id/doc/:doc_id/changes/accept',
      AuthorizationMiddleware.blockRestrictedUserFromProject,
      AuthorizationMiddleware.ensureUserCanReadProject,
      TrackChangesController.acceptChanges
    )
    webRouter.get('/project/:project_id/ranges',
      AuthorizationMiddleware.blockRestrictedUserFromProject,
      AuthorizationMiddleware.ensureUserCanReadProject,
      TrackChangesController.getAllRanges
    )
    webRouter.get('/project/:project_id/changes/users',
     AuthorizationMiddleware.blockRestrictedUserFromProject,
      AuthorizationMiddleware.ensureUserCanReadProject,
      TrackChangesController.getChangesUsers
    )
    webRouter.get(
      '/project/:project_id/threads',
      AuthorizationMiddleware.blockRestrictedUserFromProject,
      AuthorizationMiddleware.ensureUserCanReadProject,
      TrackChangesController.getThreads
    )
    webRouter.post(
      '/project/:project_id/thread/:thread_id/messages',
      AuthorizationMiddleware.blockRestrictedUserFromProject,
      AuthorizationMiddleware.ensureUserCanReadProject,
      TrackChangesController.sendComment
    )
    webRouter.post(
      '/project/:project_id/thread/:thread_id/messages/:message_id/edit',
      AuthorizationMiddleware.blockRestrictedUserFromProject,
      AuthorizationMiddleware.ensureUserCanReadProject,
      TrackChangesController.editMessage
    )
    webRouter.delete(
      '/project/:project_id/thread/:thread_id/messages/:message_id',
      AuthorizationMiddleware.blockRestrictedUserFromProject,
      AuthorizationMiddleware.ensureUserCanReadProject,
      TrackChangesController.deleteMessage
    )
    webRouter.post(
      '/project/:project_id/thread/:thread_id/resolve',
      AuthorizationMiddleware.blockRestrictedUserFromProject,
      AuthorizationMiddleware.ensureUserCanReadProject,
      TrackChangesController.resolveThread
    )
    webRouter.post(
      '/project/:project_id/thread/:thread_id/reopen',
      AuthorizationMiddleware.blockRestrictedUserFromProject,
      AuthorizationMiddleware.ensureUserCanReadProject,
      TrackChangesController.reopenThread
    )
    webRouter.delete(
      '/project/:project_id/doc/:doc_id/thread/:thread_id',
      AuthorizationMiddleware.blockRestrictedUserFromProject,
      AuthorizationMiddleware.ensureUserCanReadProject,
      TrackChangesController.deleteThread
    )
  },
}
