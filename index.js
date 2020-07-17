const ghpages = require("gh-pages");
const dir = "dist/"
ghpages.publish(dir, console.log("published!"));