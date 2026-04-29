const repo = require("./repository");
function clean(v) {
  const s = String(v || "").trim();
  return s || null;
}
function money(v) {
  return v === undefined || v === null || v === "" ? 0 : Number(v);
}
function payload(body) {
  return {
    service_line_id: body.service_line_id ? Number(body.service_line_id) : null,
    sku: clean(body.sku),
    name: clean(body.name),
    description: clean(body.description),
    item_type: clean(body.item_type) || "service",
    unit_price: money(body.unit_price),
    cost:
      body.cost === "" || body.cost === undefined ? null : Number(body.cost),
    is_active:
      body.is_active === "1" ||
      body.is_active === "true" ||
      body.is_active === "on",
  };
}

async function getInvoiceDetail(id) {
  return billingRepository.getInvoiceDetail(id);
}

async function listCatalogItems(query) {
  return repo.listCatalogItems(query || {});
}
async function getCatalogOptions() {
  return repo.getCatalogOptions();
}
async function getCatalogItem(id) {
  return repo.getCatalogItem(id);
}
async function createCatalogItem(body) {
  const data = payload(body);
  if (!data.name) throw new Error("Catalog item name is required");
  return repo.createCatalogItem(data);
}
async function updateCatalogItem(id, body) {
  const data = payload(body);
  if (!data.name) throw new Error("Catalog item name is required");
  return repo.updateCatalogItem(id, data);
}
async function deleteCatalogItem(id) {
  return repo.deleteCatalogItem(id);
}
module.exports = {
  listCatalogItems,
  getCatalogOptions,
  getCatalogItem,
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
};
