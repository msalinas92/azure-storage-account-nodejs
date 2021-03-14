const express = require('express')
const azure = require('azure-storage');
const bodyParser = require('body-parser');
var multiparty = require('multiparty');


const app = express()
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb'}));

var blobService = azure.createBlobService();
const port = 3000

/**
 * Es necesario especificar la variable BLOB_CONTAINER
 */
var blob_container = process.env.BLOB_CONTAINER;
if (blob_container == undefined) {
    console.log("Debes especificar el blob container")
    process.exit(1)
} else {
    blobService.createContainerIfNotExists(blob_container, {
        publicAccessLevel: 'blob'
    }, (error, result, response) => {
        if (error) {
            console.log(error)
        }
    });
}

/**
 * Obtiene el archivo recibiendo el nombre como parametro y dejando el 
 */
app.get('/file/:file', (req, res, next) => {
    var fileName = req.params.file;
    blobService.getBlobProperties(blob_container, fileName, (err, properties, status) => {
        if (err) {
            res.send(502, "Error al obtener el archivo: %s", err.message);
        } else if (!status.isSuccessful) {
            res.send(404, "El archivo %s no existe", fileName);
        } else {
            res.header('Content-Type', properties.contentType);
            blobService.createReadStream(blob_container, fileName).pipe(res);
        }
    });
});

/***
 * Sube el archivo por medio de form-data
 */
app.post('/file', (req, res, next) => {
    var blobService = azure.createBlobService();
    var form = new multiparty.Form();
    form.on('part', function (part) {
        if (part.filename) {

            var size = part.byteCount - part.byteOffset;
            var name = part.filename;

            blobService.createBlockBlobFromStream(blob_container, name, part, size, (error, response) => {
                if (error) {
                    res.status(500).send(error);
                } else {
                    res.status(201).send(response);
                }
            });
        } else {
            form.handlePart(part);
        }
    });
    form.parse(req);
});


app.listen(port, () => {
    console.log(`listening at http://localhost:${port}`)
})