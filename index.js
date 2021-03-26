const express = require('express')
const azure = require('azure-storage');
var formidable = require('formidable');
const bodyParser = require('body-parser');
var path = require('path');
var mime = require('mime');
var fs = require('fs');

/**
 * Se deben especificar las variables :
 * AZURE_STORAGE_CONNECTION_STRING: el connection string del SAS
 * BLOB_CONTAINER : El nombre del blob container
 */
const app = express()
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));

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
 * Obtiene el archivo recibiendo el nombre como parametro y dejando el archivo como archivo temporal
 * El archivo es eliminado del ambiente local al finalizar.
 */
app.get('/read/:file', (req, res, next) => {
    var fileName = req.params.file;
    blobService.getBlobProperties(blob_container, fileName, (err, properties, status) => {

        blobService.getBlobToLocalFile(blob_container, fileName, './file/' + fileName, error => {
            if (error) {
                res.send(502, "Error al obtener el archivo: %s", error);
            } else {

                var file = './file/' + fileName;
                var filename = path.basename(file);
                var mimetype = mime.getType(file);
                res.setHeader('Content-disposition', 'inline; filename=' + filename);
                res.setHeader('Content-type', mimetype);
                var filestream = fs.createReadStream(file);
                filestream.pipe(res);
                console.log(' Blob ' + fileName + ' download finished.');
            }
        });


    });

    res.on('finish', () => {
        try {
            fs.unlinkSync('./file/' + fileName)
        } catch (err) {
            console.error(err)
        }
    });
});



/**
 * Obtiene el archivo recibiendo el nombre como parametro y dejando el 
 */
app.get('/file/:file', (req, res, next) => {
    var fileName = req.params.file;
    blobService.getBlobProperties(blob_container, fileName, (err, properties, status) => {
        console.log(properties);
        if (err) {
            res.send(502, "Error al obtener el archivo: %s", err.message);
        } else if (!status.isSuccessful) {
            res.send(404, "El archivo %s no existe", fileName);
        } else {
            res.header('Content-Type', properties.contentType);
            res.header('content-disposition', 'attachment; filename=' + properties.name);
            blobService.createReadStream(blob_container, fileName).pipe(res);
        }
    });
});

/***
 * Sube el archivo por medio de form-data
 */
app.post('/file', (req, res, next) => {
    var blobService = azure.createBlobService();

    var form = new formidable.IncomingForm();

    form.parse(req, (err, fields, files) => {

        var options = {
            contentType: files.file.type,
            metadata: { fileName: files.file.name }
        };

        blobService.createBlockBlobFromLocalFile(blob_container, files.file.name, files.file.path, options, (error) => {
            if (error == null) {
                res.status(201).send({ message: "Archivo subido exitosamente" });
            } else {
                res.status(500).send(error);
            }
        });
    });

});


app.listen(port, () => {
    console.log(`listening at http://localhost:${port}`)
})