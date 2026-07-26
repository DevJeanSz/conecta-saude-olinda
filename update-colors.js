const fs = require('fs');
const path = require('path');

const filesToUpdate = ['Users.tsx', 'Units.tsx', 'Specialties.tsx', 'Schedule.tsx', 'Patients.tsx', 'Reports.tsx'];
const dir = path.join(__dirname, 'pages');

filesToUpdate.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        content = content.replace(/medical-600/g, 'primary');
        content = content.replace(/medical-700/g, 'primary-dark');
        content = content.replace(/medical-500/g, 'primary');
        content = content.replace(/medical-400/g, 'primary');
        content = content.replace(/medical-50/g, 'blue-50');
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${file}`);
    }
});
