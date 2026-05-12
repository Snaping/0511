import { io, Socket } from 'socket.io-client';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import { encoding, decoding } from 'lib0';

const SERVER_URL = 'http://localhost:3001';

export interface Connection {
  socket: Socket;
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  destroy: () => void;
}

export function createCollabConnection(
  docId: string,
  userId: string,
  userName: string
): Connection {
  const doc = new Y.Doc();
  const awareness = new awarenessProtocol.Awareness(doc);

  awareness.setLocalStateField('user', { id: userId, name: userName });

  const socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });

  const onYjsMessage = (message: ArrayBuffer) => {
    const encoder = encoding.createEncoder();
    const decoder = decoding.createDecoder(new Uint8Array(message));
    const messageType = decoding.readVarUint(decoder);

    switch (messageType) {
      case 0:
        encoding.writeVarUint(encoder, 0);
        syncProtocol.readSyncMessage(decoder, encoder, doc, null);
        if (encoding.length(encoder) > 1) {
          socket.emit('yjs-message', encoding.toUint8Array(encoder));
        }
        break;
      case 1:
        awarenessProtocol.applyAwarenessUpdate(
          awareness,
          decoding.readVarUint8Array(decoder),
          socket
        );
        break;
    }
  };

  const sendStep1 = () => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, 0);
    syncProtocol.writeSyncStep1(encoder, doc);
    socket.emit('yjs-message', encoding.toUint8Array(encoder));

    const awarenessStates = awareness.getStates();
    if (awarenessStates.size > 0) {
      const encoderAwareness = encoding.createEncoder();
      encoding.writeVarUint(encoderAwareness, 1);
      encoding.writeVarUint8Array(
        encoderAwareness,
        awarenessProtocol.encodeAwarenessUpdate(
          awareness,
          Array.from(awarenessStates.keys())
        )
      );
      socket.emit('yjs-message', encoding.toUint8Array(encoderAwareness));
    }
  };

  doc.on('update', (update: Uint8Array, _origin: unknown) => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, 0);
    syncProtocol.writeUpdate(encoder, update);
    socket.emit('yjs-message', encoding.toUint8Array(encoder));
  });

  awareness.on('update', () => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, 1);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(
        awareness,
        Array.from(awareness.getLocalState() ? [doc.clientID] : [])
      )
    );
    socket.emit('yjs-message', encoding.toUint8Array(encoder));
  });

  socket.on('connect', () => {
    socket.emit('join', { docId, userId, userName });
    sendStep1();
  });

  socket.on('yjs-message', onYjsMessage);

  const destroy = () => {
    awareness.destroy();
    doc.destroy();
    socket.disconnect();
  };

  return { socket, doc, awareness, destroy };
}
