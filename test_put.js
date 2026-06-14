const jwt = require('jsonwebtoken');
const token = jwt.sign({id: 1, username: 'admin', role: 'admin'}, 'super_secret_jwt_key_kppedia_2026');

async function testPut() {
    const payload = {
        name: 'Sample Proposal Pengajuan KP',
        type: 'pdf',
        url: '/documents/file-1781419108098.pdf',
        keywords: 'sample, pengajuan kp, sample proposal pengajuan kp'.split(',').map(k=>k.trim())
    };

    const res = await fetch('http://localhost:3000/api/admin/documents/sample', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify(payload)
    });
    
    console.log("Status:", res.status);
    console.log("Text:", await res.text());
}
testPut().catch(console.error);
