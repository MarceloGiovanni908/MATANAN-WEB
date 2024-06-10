const express = require('express');
const multer = require('multer');
const path = require('path');
const tf = require('@tensorflow/tfjs-node');
const mysql = require('mysql');
const fs = require('fs');

const app = express();
const port = 3000;

// Load the model
let model;
(async function() {
    const modelPath = path.join(__dirname, 'model.json');
    model = await tf.loadLayersModel('file://' + modelPath);
})();

// Set up Multer for file uploads
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: function(req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Serve static files
app.use(express.static('public'));

// Initialize MySQL database connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '123', // Ganti dengan password MySQL Anda
    database: 'data_comvis'
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL database', err.message);
    } else {
        console.log('Connected to the MySQL database.');
    }
});

// Label map to convert prediction index to food name
const labelMap = {
    1: 'ayam betutu',
    2: 'beberuk terong',
    3: 'coto makassar',
    4: 'gudeg',
    5: 'kerak telor',
    6: 'mie aceh',
    7: 'nasi kuning',
    8: 'nasi pecel',
    9: 'papeda',
    10: 'pempek',
    11: 'peuyeum',
    12: 'rawon',
    13: 'rendang',
    14: 'sate Madura',
    15: 'serabi',
    16: 'soto banjar',
    17: 'soto lamongan',
    18: 'tahu sumedang',
};

// Function to predict the food name from an image
async function predictFood(imagePath) {
    const image = cv.imread(imagePath);
    const resizedImage = image.resize(224, 224);
    const inputTensor = tf.tensor3d(resizedImage.getData(), [224, 224, 3], 'int32').expandDims(0).div(255.0);

    const predictions = model.predict(inputTensor);
    const foodIndex = predictions.argMax(1).dataSync()[0];
    const foodName = labelMap[foodIndex];

    return foodName;
}

// Function to get recipes from database
function getRecipesFromDb(foodName) {
    return new Promise((resolve, reject) => {
        db.query("SELECT * FROM resep WHERE food_name = ?", [foodName], (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results);
            }
        });
    });
}

// Route to handle image upload and prediction
app.post('/upload', upload.single('file'), async (req, res) => {
    const filePath = req.file.path;

    try {
        const foodName = await predictFood(filePath);
        const recipes = await getRecipesFromDb(foodName);

        res.json(recipes);
    } catch (err) {
        res.status(500).send(err.message);
    } finally {
        fs.unlinkSync(filePath); // Clean up uploaded file
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});