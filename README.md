# Consulta Electoral ONPE 2026

Aplicacion web que permite verificar si una lista de DNIs peruanos corresponden a miembros de mesa electoral, consultando automaticamente el portal oficial de la ONPE.

---

## Descripcion del proyecto

El usuario sube un archivo Excel con una columna de DNIs. La aplicacion abre el portal de la ONPE por cada DNI usando Puppeteer (automatizacion de navegador), extrae la informacion y la muestra en pantalla en tiempo real. Al finalizar, el usuario puede descargar los resultados como un nuevo archivo Excel.

### Datos que se obtienen por cada DNI

| Campo | Descripcion |
|---|---|
| DNI | Numero de documento consultado |
| Ubicacion | Region / Provincia / Distrito |
| Direccion del local | Direccion exacta del local de votacion |
| Es miembro de mesa | MIEMBRO TITULAR, MIEMBRO ACCESITARIO, PRESIDENTE DE MESA o NO |

---

## Tecnologias utilizadas

| Tecnologia | Uso |
|---|---|
| Node.js | Runtime del servidor |
| Express | Framework web / API REST |
| Puppeteer | Automatizacion del navegador para scraping de ONPE |
| Multer | Manejo de archivos subidos (Excel) |
| xlsx | Lectura y escritura de archivos Excel |
| Docker | Contenedorizacion de la aplicacion |
| Chromium | Navegador usado por Puppeteer dentro del contenedor |

---

## Requisitos previos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y en ejecucion
- (Opcional) Node.js 18+ si quieres ejecutar sin Docker

---

## Estructura del proyecto

```
caso2/
├── src/
│   └── app.js                  # Logica principal del servidor
├── uploads/                    # Carpeta temporal para archivos subidos
├── Dockerfile                  # Imagen base con Puppeteer oficial
├── Dockerfile.optimizado       # Imagen Alpine con Chromium del sistema
├── Dockerfile.multistage       # Multi-stage build con Alpine
├── .dockerignore               # Archivos excluidos del contexto Docker
├── package.json                # Dependencias del proyecto
├── start.sh                    # Script de arranque
└── README.md                   # Este archivo
```

---

## Instalacion y ejecucion con Docker

Hay 3 versiones de imagen disponibles. Cada una tiene diferente tamano y caracteristicas.

---

### Version 1 — Imagen base con Puppeteer oficial (`Dockerfile`)

Usa la imagen oficial de Puppeteer que ya incluye Google Chrome. Es la mas compatible y estable.

```bash
# Detener y eliminar contenedor anterior (si existe)
docker stop onpe-container
docker rm onpe-container

# Construir la imagen
docker build -t onpe-consulta:v1.0 .

# Ejecutar el contenedor
docker run -d -p 3000:3000 --name onpe-container onpe-consulta:v1.0

# Ver los logs para verificar que arranco correctamente
docker logs onpe-container
```

---

### Version 2 — Imagen optimizada Alpine (`Dockerfile.optimizado`)

Usa Node.js sobre Alpine Linux con Chromium instalado desde los repositorios del sistema. Incluye HEALTHCHECK. Imagen mas liviana que la v1.0.

```bash
docker stop onpe-container
docker rm onpe-container

docker build -f Dockerfile.optimizado -t onpe-consulta:v1.1-alpine .

docker run -d -p 3000:3000 --name onpe-container onpe-consulta:v1.1-alpine

docker logs onpe-container
```

---

### Version 3 — Multi-stage build (`Dockerfile.multistage`)

Separa la etapa de instalacion de dependencias de la etapa final. La imagen resultante no incluye herramientas de build, lo que la hace la mas ligera de las tres.

```bash
docker stop onpe-container
docker rm onpe-container

docker build -f Dockerfile.multistage -t onpe-consulta:v1.2-multistage .

docker run -d -p 3000:3000 --name onpe-container onpe-consulta:v1.2-multistage

docker logs onpe-container
```

---

### Comparacion de tamanos de imagen

```bash
# Ver todas las imagenes generadas y sus tamanos
docker images | grep onpe-consulta
```

| Version | Base | Tamano aproximado |
|---|---|---|
| v1.0 | Puppeteer oficial (Debian) | ~1.5 GB |
| v1.1-alpine | Alpine + Chromium | ~500 MB |
| v1.2-multistage | Alpine + Chromium (multi-stage) | ~500 MB |

---

## Ejecucion sin Docker (modo desarrollo)

```bash
# Instalar dependencias
npm install

# Ejecutar la aplicacion
node src/app.js
```

La aplicacion estara disponible en `http://localhost:3000`

> Nota: En Windows, Puppeteer usara el Chrome que tiene instalado. En caso de error, asegurate de tener Google Chrome instalado en tu equipo.

---

## Uso de la aplicacion

1. Abre el navegador en `http://localhost:3000`
2. Prepara un archivo Excel (`.xlsx`) con una columna llamada **DNI**
3. Haz clic en **Seleccionar archivo** y elige tu Excel
4. Haz clic en **Consultar ONPE**
5. Espera mientras la app consulta cada DNI (puede tardar unos segundos por DNI)
6. Los resultados aparecen en pantalla en tiempo real
7. Haz clic en **Descargar Excel con resultados** para exportar

### Formato del Excel de entrada

| DNI |
|---|
| 12345678 |
| 87654321 |
| ... |

---

## Publicar en Docker Hub

Las 3 imagenes se publican en [hub.docker.com/u/juan12211](https://hub.docker.com/u/juan12211)

### Paso 1 — Iniciar sesion

```bash
docker login
```

### Paso 2 — Etiquetar las imagenes con tu usuario

```bash
docker tag onpe-consulta:v1.0           juan12211/onpe-consulta:v1.0
docker tag onpe-consulta:v1.1-alpine    juan12211/onpe-consulta:v1.1-alpine
docker tag onpe-consulta:v1.2-multistage juan12211/onpe-consulta:v1.2-multistage
```

### Paso 3 — Subir las imagenes

```bash
docker push juan12211/onpe-consulta:v1.0
docker push juan12211/onpe-consulta:v1.1-alpine
docker push juan12211/onpe-consulta:v1.2-multistage
```

### Paso 4 — Ejecutar directo desde Docker Hub (sin clonar el repo)

```bash
docker run -d -p 3000:3000 --name onpe-container juan12211/onpe-consulta:v1.0
```

---

## Comandos utiles de Docker

```bash
# Ver contenedores en ejecucion
docker ps

# Ver logs en tiempo real
docker logs -f onpe-container

# Detener el contenedor
docker stop onpe-container

# Eliminar el contenedor
docker rm onpe-container

# Eliminar una imagen
docker rmi onpe-consulta:v1.0

# Ver todas las imagenes
docker images
```

---

## Conclusiones

1. **Docker permite estandarizar entornos de ejecucion.** La aplicacion funciona igual en cualquier maquina que tenga Docker instalado, sin importar el sistema operativo del host. Esto elimina el clasico problema de "en mi maquina funciona".

2. **El uso de `.dockerignore` mejora el rendimiento del build.** Al excluir carpetas como `node_modules` y archivos temporales, se reduce el tamano del contexto que Docker envia al daemon, acelerando la construccion de la imagen.

3. **Las imagenes Alpine reducen significativamente el tamano final.** Usar `node:18-alpine` en lugar de la imagen base de Debian reduce el tamano de la imagen a menos de la mitad, lo que se traduce en despliegues mas rapidos y menor uso de almacenamiento.

4. **El multi-stage build es la mejor practica para produccion.** Al separar la etapa de build de la etapa de ejecucion, la imagen final no contiene herramientas de compilacion ni dependencias de desarrollo, resultando en una imagen mas segura y liviana.

5. **Ejecutar el navegador en modo headless es obligatorio en contenedores.** Los contenedores Docker no tienen interfaz grafica. Configurar Puppeteer con `headless: true` y usar el Chromium del sistema operativo del contenedor (`PUPPETEER_EXECUTABLE_PATH`) es la forma correcta de usar automatizacion de navegador en un entorno de servidor.

6. **El HEALTHCHECK mejora la observabilidad del contenedor.** Permite que Docker (y orquestadores como Kubernetes) sepan si el contenedor esta realmente listo para recibir trafico, no solo si el proceso esta corriendo.
