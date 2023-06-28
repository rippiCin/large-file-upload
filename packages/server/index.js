const http = require('http');

const server = http.createServer((_, response) => {
  response.end('hello Http server');
});

server.listen(9000, () => {
  console.log('服务已经启动了...');
})
