docker exec -it overleafserver bash -ce "mkdir /var/lib/overleaf/to_mod"
docker exec -it overleafserver bash -ce "cp /overleaf/services/web/app/src/Features/Email/EmailBuilder.js /var/lib/overleaf/to_mod"
docker exec -it overleafserver bash -ce "cp /overleaf/services/web/app/src/Features/Project/ProjectEditorHandler.js /var/lib/overleaf/to_mod"
docker exec -it overleafserver bash -ce "cp /overleaf/services/web/modules/track-changes/app/src/TrackChangesController.js /var/lib/overleaf/to_mod"
docker exec -it overleafserver bash -ce "cp /overleaf/services/web/modules/track-changes/app/src/TrackChangesRouter.js /var/lib/overleaf/to_mod"
docker exec -it overleafserver bash -ce "cp /overleaf/services/web/modules/track-changes/index.js /var/lib/overleaf/to_mod"
docker exec -it overleafserver bash -ce "cp /overleaf/services/web/config/settings.defaults.js /var/lib/overleaf/to_mod"
docker exec -it overleafserver bash -ce "cp /overleaf/services/clsi/app/js/LatexRunner.js /var/lib/overleaf/to_mod"