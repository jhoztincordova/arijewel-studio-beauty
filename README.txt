ARIJEWEL STUDIO BEAUTY — PRODUCCIÓN
===================================

Dominio objetivo:
https://arijewelstudio.com

SEPARACIÓN
----------
La separación es el 50% de cada servicio:
- Limpieza Facial Básica: S/ 45 -> S/ 22.50
- Facial Hidratante: S/ 50 -> S/ 25.00
- Facial Revitalizante: S/ 60 -> S/ 30.00
- Facial Piel Sensible: S/ 55 -> S/ 27.50
- Facial Peeling: S/ 80 -> S/ 40.00 (precio base mostrado)
- Microneedling: S/ 75 -> S/ 37.50

PAGOS
-----
Se dejó preparado el checkout de Culqi para cobrar la separación.
El backend conserva la llave privada y procesa el cobro en el servidor.
Para activar cobros reales hay que colocar las llaves de producción de tu cuenta Culqi:
CULQI_PUBLIC_KEY
CULQI_PRIVATE_KEY

La cuenta de Culqi debe estar afiliada/validada para producción. Culqi permite configurar tarjetas, Yape y otros medios que estén habilitados para el comercio.

SERVIDOR
--------
Incluye render.yaml para desplegar como Web Service en Render.
Variables:
ADMIN_KEY
CULQI_PUBLIC_KEY
CULQI_PRIVATE_KEY
BASE_URL=https://arijewelstudio.com

DOMINIO
-------
El proyecto está preparado para arijewelstudio.com.
La compra/registro del dominio y la configuración final del DNS requieren acceso a la cuenta donde se compre el dominio; no se puede hacer desde este chat sin esas credenciales.
Render puede conectar un dominio propio y emitir/renovar HTTPS automáticamente después de verificarlo.

PANEL
-----
/admin.html

La clave se configura con ADMIN_KEY.
