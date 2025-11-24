const bcrypt = require('bcrypt');

(async () => {
    console.log("Faculty hash:");
    console.log(await bcrypt.hash("faculty", 10));

    console.log("\nStudent hash:");
    console.log(await bcrypt.hash("student", 10));
})();
