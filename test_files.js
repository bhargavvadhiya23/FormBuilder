const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testFileUpload() {
    const filePath = path.join(__dirname, 'test_file.txt');
    fs.writeFileSync(filePath, 'Hello World');

    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));

    try {
        console.log('--- Testing Upload ---');
        const uploadRes = await axios.post('http://localhost:8080/api/files/upload', form, {
            headers: form.getHeaders()
        });
        console.log('Upload Response:', uploadRes.data);
        const savedName = uploadRes.data.fileName;

        console.log('\n--- Testing Download with dName=my_custom_name.txt ---');
        const downloadRes = await axios.get(`http://localhost:8080/api/files/download/${savedName}?dName=my_custom_name.txt`);
        console.log('Download Headers:', downloadRes.headers);
        const contentDisposition = downloadRes.headers['content-disposition'];
        console.log('Content-Disposition:', contentDisposition);

        if (contentDisposition && contentDisposition.includes('my_custom_name.txt')) {
            console.log('✅ SUCCESS: Content-Disposition header correctly uses dName.');
        } else {
            console.error('❌ FAILURE: Content-Disposition header did not use dName or is incorrect.');
        }

    } catch (error) {
        console.error('Error during test:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    } finally {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
}

testFileUpload();
