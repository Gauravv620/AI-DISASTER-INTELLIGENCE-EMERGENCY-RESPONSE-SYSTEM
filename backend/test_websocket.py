import asyncio
import json
import websockets


async def test_websocket():
    uri = "ws://127.0.0.1:8000/ws/alerts"

    print("Connecting to AIDERS WebSocket...")

    async with websockets.connect(uri) as websocket:
        print("Connected.")

        while True:
            message = await websocket.recv()

            data = json.loads(message)

            print("\nReceived:")
            print(json.dumps(data, indent=2))


asyncio.run(test_websocket())