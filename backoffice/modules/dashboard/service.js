const repository = require("./repository");
async function getDashboard() {
  return repository.getDashboard();
}
module.exports = { getDashboard };
