const { createServer } = process.getBuiltinModule('node:http');

const server = createServer((_request, response) => {
    response.end(process.pid.toString());
});

server.on('error', (error) => {
    process.stderr.write(`${error.code}\n`);
    process.exit(1);
});
server.listen(Number(process.argv[2]), '127.0.0.1', () => {
    process.stdout.write('ready\n');
});

process.on('SIGTERM', () => {
    setTimeout(() => server.close(() => process.exit(0)), Number(process.argv[3] || 350));
});
