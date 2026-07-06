# Skills Registry: Immersive Automation 🤖

In questa cartella verranno salvati gli script e i tool (le "Skill") che l'agente utilizzerà per automatizzare i compiti ricorsivi.

## Skill Pianificate (Proposte):

1.  **doc_generator.sh / .js**: Per generare automaticamente file README o documentazione tecnica del progetto.
2.  **env_setup.sh**: Per installare le dipendenze necessarie (Three.js, R3F, GSAP, etc.) in un nuovo progetto.
3.  **task_breaker.js**: Per prendere un input complesso ("Voglio un gioco di macchine") e scomporlo in mini-task atomici salvati in un file `TASKS.md`.
4.  **asset_optimizer.sh**: Per passare i modelli GLB attraverso pipeline di compressione (Draco/Meshopt).
5.  **scene_scaffolder.js**: Per generare il codice base di una scena (Boilerplate) a seconda del framework scelto.
6.  **learning_logger.js**: Per estrarre i concetti appresi durante una chat e salvarli in un diario di formazione.

*Nota per l'Agente: Quando l'utente chiede una di queste attività, verifica se il file corrispondente esiste qui ed esegui quello invece di procedere manualmente.*
