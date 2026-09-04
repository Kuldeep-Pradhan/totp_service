const cluster = require('cluster');
const os = require('os');
const path = require('path');

if (cluster.isMaster) {
  const numCPUs = os.cpus().length;
  console.log(`[Cluster] Master ${process.pid} is running`);
  console.log(`[Cluster] Forking ${numCPUs} workers...`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`[Cluster] Worker ${worker.process.pid} died. Restarting...`);
    cluster.fork();
  });
} else {
  // Load the main Express app
  console.log = function() {}; console.info = function() {}; require('./app.js');
  console.log(`[Cluster] Worker ${process.pid} started`);
}
