import { Server, Socket } from 'socket.io';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import { encoding, decoding } from 'lib0';
import { saveDocumentState, loadDocumentState } from './services/documentService';
import type { Version, Snapshot } from './services/documentService';

const rooms = new Map<string, {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  users: Set<string>;
}>();

const messageSync = 0;
const messageAwareness = 1;

let ioInstance: Server | null = null;

export function broadcastCommentEvent(
  docId: string,
  event: 'comment:created' | 'comment:updated' | 'comment:deleted',
  payload: any
) {
  if (ioInstance) {
    ioInstance.to(docId).emit(event, payload);
  }
}

export function broadcastVersionCreated(docId: string, version: Version) {
  if (ioInstance) {
    ioInstance.to(docId).emit('version:created', version);
  }
}

export function broadcastSnapshotCreated(docId: string, snapshot: Snapshot) {
  if (ioInstance) {
    ioInstance.to(docId).emit('snapshot:created', snapshot);
  }
}

export function broadcastDocumentRestored(docId: string, source: 'version' | 'snapshot', sourceId: string) {
  if (ioInstance) {
    ioInstance.to(docId).emit('document:restored', { source, sourceId });
  }
}

export async function applyDocumentUpdate(docId: string, state: Uint8Array): Promise<void> {
  const room = rooms.get(docId);
  if (room) {
    Y.applyUpdate(room.doc, state);
  }
}

export function setupSocket(io: Server) {
  ioInstance = io;
  io.on('connection', (socket: Socket) => {
    let currentDocId: string | null = null;

    socket.on('join', async ({ docId, userId, userName }: {
      docId: string;
      userId: string;
      userName: string;
    }) => {
      currentDocId = docId;

      let room = rooms.get(docId);
      if (!room) {
        const doc = new Y.Doc();
        const awareness = new awarenessProtocol.Awareness(doc);

        const savedState = await loadDocumentState(docId);
        if (savedState) {
          Y.applyUpdate(doc, savedState);
        }

        doc.on('update', async (update: Uint8Array, _origin: unknown) => {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, messageSync);
          syncProtocol.writeSyncStep2(encoder, doc);
          io.to(docId).emit('yjs-message', encoding.toUint8Array(encoder));
          await saveDocumentState(docId, Y.encodeStateAsUpdate(doc));
        });

        awareness.on('update', () => {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, messageAwareness);
          encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(
            awareness,
            Array.from(awareness.getStates().keys())
          ));
          io.to(docId).emit('yjs-message', encoding.toUint8Array(encoder));
        });

        room = { doc, awareness, users: new Set() };
        rooms.set(docId, room);
      }

      room.users.add(socket.id);
      socket.join(docId);

      room.awareness.setLocalState({
        user: { id: userId, name: userName },
        cursor: null
      });

      io.to(docId).emit('users-update', Array.from(room.users));
    });

    socket.on('yjs-message', (message: ArrayBuffer) => {
      if (!currentDocId) return;
      const room = rooms.get(currentDocId);
      if (!room) return;

      const encoder = encoding.createEncoder();
      const decoder = decoding.createDecoder(new Uint8Array(message));
      const messageType = decoding.readVarUint(decoder);

      switch (messageType) {
        case messageSync:
          encoding.writeVarUint(encoder, messageSync);
          syncProtocol.readSyncMessage(decoder, encoder, room.doc, null);
          if (encoding.length(encoder) > 1) {
            io.to(currentDocId).emit('yjs-message', encoding.toUint8Array(encoder));
          }
          break;
        case messageAwareness:
          awarenessProtocol.applyAwarenessUpdate(
            room.awareness,
            decoding.readVarUint8Array(decoder),
            socket
          );
          break;
      }
    });

    socket.on('disconnect', () => {
      if (!currentDocId) return;
      const room = rooms.get(currentDocId);
      if (!room) return;

      room.users.delete(socket.id);
      io.to(currentDocId).emit('users-update', Array.from(room.users));

      if (room.users.size === 0) {
        room.awareness.destroy();
        room.doc.destroy();
        rooms.delete(currentDocId);
      }
    });
  });
}

export { rooms };
