import { AppState, AppStateStatus } from 'react-native';
import { useChatStore, QueuedMessage } from '../chatStore';
import { sendProutViaBackend } from '../sendProutBackend';

class OfflineService {
  private processing = false;
  private interval: NodeJS.Timeout | null = null;

  constructor() {
    AppState.addEventListener('change', this.handleAppStateChange);
    this.startInterval();
  }

  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      this.processQueue();
    }
  };

  private startInterval() {
    if (this.interval) clearInterval(this.interval);
    this.interval = setInterval(() => {
      this.processQueue();
    }, 15000); // Toutes les 15 secondes
  }

  public async processQueue() {
    if (this.processing) return;
    
    const queue = useChatStore.getState().pendingSendQueue;
    if (queue.length === 0) return;

    this.processing = true;
    console.log(`🔄 [OfflineService] Processing queue (${queue.length} messages)...`);

    // On traite les messages un par un
    for (const msg of queue) {
      try {
        await this.attemptSend(msg);
        // Succès : on le retire de la queue
        useChatStore.getState().removeFromQueue(msg.localId);
        console.log(`✅ [OfflineService] Message ${msg.localId} sent successfully.`);
      } catch (error) {
        console.log(`❌ [OfflineService] Failed to send ${msg.localId}. Will retry later.`);
        // Échec : on s'arrête là pour ce tour (probablement toujours offline)
        break;
      }
    }

    this.processing = false;
  }

  private async attemptSend(msg: QueuedMessage) {
    return sendProutViaBackend(
      msg.recipientToken,
      msg.senderPseudo,
      msg.proutKey,
      msg.platform,
      msg.extraData
    );
  }
}

export const offlineService = new OfflineService();
