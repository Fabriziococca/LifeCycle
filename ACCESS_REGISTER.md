# Accesos de LifeCycle

El registro canónico operativo es local: [docs/ACCESS_REGISTER.md](docs/ACCESS_REGISTER.md). Está ignorado por Git y se conserva en esta misma carpeta al cambiar de chat.

Ese registro distingue la cuenta propietaria, QA, conectores, repositorio, roles comprobados, sesiones y recursos de navegador. No contiene secretos; no persistir allí contraseñas, cookies, tokens, claves privadas, UUID de usuarios ni endpoints Push.

Si se trabaja desde otra copia donde el registro privado no está disponible, verificar primero los recursos conectados y las autorizaciones conservadas en el proyecto; pedir únicamente el acceso que falte. El historial de una sesión autenticada no garantiza que siga disponible o se transfiera.
