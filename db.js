const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || '/data/data.json';
const dir = path.dirname(DB_PATH);

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

function readDB() {
  if (!fs.existsSync(DB_PATH)) {
    const initialData = {
      users: [],
      dailyPlans: [],
      meals: [],
      workouts: [],
      progress: [],
      gutHealth: []
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function getAll(collection) {
  const data = readDB();
  return data[collection] || [];
}

function getById(collection, id) {
  const data = readDB();
  const items = data[collection] || [];
  return items.find(item => item.id === id);
}

function insert(collection, item) {
  const data = readDB();
  if (!data[collection]) data[collection] = [];
  
  item.id = item.id || Date.now().toString() + Math.random().toString(36).substr(2, 9);
  item.createdAt = new Date().toISOString();
  
  data[collection].push(item);
  writeDB(data);
  return item;
}

function update(collection, id, updates) {
  const data = readDB();
  const items = data[collection] || [];
  const index = items.findIndex(item => item.id === id);
  
  if (index !== -1) {
    items[index] = { ...items[index], ...updates, updatedAt: new Date().toISOString() };
    writeDB(data);
    return items[index];
  }
  return null;
}

function remove(collection, id) {
  const data = readDB();
  const items = data[collection] || [];
  const filtered = items.filter(item => item.id !== id);
  
  if (filtered.length !== items.length) {
    data[collection] = filtered;
    writeDB(data);
    return true;
  }
  return false;
}

module.exports = { getAll, getById, insert, update, remove };