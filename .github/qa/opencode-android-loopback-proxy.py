import asyncio
import pathlib
import sys

port_file, target_port = pathlib.Path(sys.argv[1]), int(sys.argv[2])


async def forward(reader, writer):
    try:
        async for block in iter_chunks(reader):
            writer.write(block)
            await writer.drain()
        writer.write_eof()
    except (ConnectionError, OSError):
        pass


async def iter_chunks(reader):
    while chunk := await reader.read(64 * 1024):
        yield chunk


async def proxy(reader, writer):
    target_reader, target_writer = await asyncio.open_connection("127.0.0.1", target_port)
    try:
        await asyncio.gather(forward(reader, target_writer), forward(target_reader, writer))
    finally:
        target_writer.close()
        writer.close()


async def main():
    server = await asyncio.start_server(proxy, "127.0.0.1", 0)
    port_file.write_text(f"{server.sockets[0].getsockname()[1]}\n")
    async with server:
        await server.serve_forever()


asyncio.run(main())
