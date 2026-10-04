/**
 * Gamepad Service for Ergonomic Flashcard Review
 * Supports 8BitDo Zero 2, 8BitDo Micro, Xbox, DualSense/DualShock, Nintendo Switch Joy-Cons,
 * and generic Bluetooth/USB gamepads via the standard HTML5 Gamepad API.
 */

export type GamepadAction = 
  | 'flip' 
  | 'again' 
  | 'hard' 
  | 'good' 
  | 'easy' 
  | 'hint' 
  | 'prev' 
  | 'next';

export interface GamepadStatus {
  connected: boolean;
  name: string | null;
  timestamp: number;
}

type ActionCallback = (action: GamepadAction) => void;
type StatusCallback = (status: GamepadStatus) => void;

export class GamepadService {
  private static instance: GamepadService;
  private actionListeners: Set<ActionCallback> = new Set();
  private statusListeners: Set<StatusCallback> = new Set();
  private animationFrameId: number | null = null;
  private isPolling: boolean = false;
  private prevButtonStates: boolean[] = [];
  private activeGamepadName: string | null = null;
  private isConnected: boolean = false;

  private constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('gamepadconnected', this.handleConnected);
      window.addEventListener('gamepaddisconnected', this.handleDisconnected);
    }
  }

  public static getInstance(): GamepadService {
    if (!GamepadService.instance) {
      GamepadService.instance = new GamepadService();
    }
    return GamepadService.instance;
  }

  public subscribeAction(callback: ActionCallback): () => void {
    this.actionListeners.add(callback);
    this.ensurePolling();
    return () => {
      this.actionListeners.delete(callback);
      if (this.actionListeners.size === 0 && this.statusListeners.size === 0) {
        this.stopPolling();
      }
    };
  }

  public subscribeStatus(callback: StatusCallback): () => void {
    this.statusListeners.add(callback);
    callback({
      connected: this.isConnected,
      name: this.activeGamepadName,
      timestamp: Date.now(),
    });
    this.ensurePolling();
    return () => {
      this.statusListeners.delete(callback);
      if (this.actionListeners.size === 0 && this.statusListeners.size === 0) {
        this.stopPolling();
      }
    };
  }

  public getStatus(): GamepadStatus {
    return {
      connected: this.isConnected,
      name: this.activeGamepadName,
      timestamp: Date.now(),
    };
  }

  private handleConnected = (e: GamepadEvent) => {
    this.isConnected = true;
    this.activeGamepadName = e.gamepad.id || 'Standard Gamepad Controller';
    this.notifyStatus();
    this.ensurePolling();
  };

  private handleDisconnected = () => {
    this.isConnected = false;
    this.activeGamepadName = null;
    this.notifyStatus();
  };

  private notifyStatus() {
    const status = this.getStatus();
    this.statusListeners.forEach(cb => cb(status));
  }

  private ensurePolling() {
    if (this.isPolling) return;
    this.isPolling = true;
    this.pollLoop();
  }

  private stopPolling() {
    this.isPolling = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private pollLoop = () => {
    if (!this.isPolling) return;

    if (typeof navigator !== 'undefined' && navigator.getGamepads) {
      const gamepads = navigator.getGamepads();
      let primaryPad: Gamepad | null = null;

      for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i] && gamepads[i]?.connected) {
          primaryPad = gamepads[i];
          break;
        }
      }

      if (primaryPad) {
        if (!this.isConnected) {
          this.isConnected = true;
          this.activeGamepadName = primaryPad.id || 'Standard Gamepad';
          this.notifyStatus();
        }

        this.processGamepadInputs(primaryPad);
      } else if (this.isConnected) {
        this.isConnected = false;
        this.activeGamepadName = null;
        this.notifyStatus();
      }
    }

    this.animationFrameId = requestAnimationFrame(this.pollLoop);
  };

  private processGamepadInputs(pad: Gamepad) {
    const buttons = pad.buttons;
    const count = buttons.length;

    // Check edge triggers (transition from false to true)
    for (let i = 0; i < count; i++) {
      const isPressed = buttons[i].pressed;
      const wasPressed = !!this.prevButtonStates[i];

      if (isPressed && !wasPressed) {
        this.dispatchButton(i);
      }

      this.prevButtonStates[i] = isPressed;
    }

    // Also check standard D-Pad axes if represented via axes instead of buttons
    if (pad.axes && pad.axes.length >= 2) {
      const x = pad.axes[0];
      const y = pad.axes[1];

      // D-Pad Left
      if (x < -0.6 && (!this.prevButtonStates[100])) {
        this.emitAction('again');
        this.prevButtonStates[100] = true;
      } else if (x >= -0.3) {
        this.prevButtonStates[100] = false;
      }

      // D-Pad Right
      if (x > 0.6 && (!this.prevButtonStates[101])) {
        this.emitAction('good');
        this.prevButtonStates[101] = true;
      } else if (x <= 0.3) {
        this.prevButtonStates[101] = false;
      }

      // D-Pad Up
      if (y < -0.6 && (!this.prevButtonStates[102])) {
        this.emitAction('easy');
        this.prevButtonStates[102] = true;
      } else if (y >= -0.3) {
        this.prevButtonStates[102] = false;
      }

      // D-Pad Down
      if (y > 0.6 && (!this.prevButtonStates[103])) {
        this.emitAction('hard');
        this.prevButtonStates[103] = true;
      } else if (y <= 0.3) {
        this.prevButtonStates[103] = false;
      }
    }
  }

  private dispatchButton(index: number) {
    // Standard W3C Gamepad Mapping:
    // 0: A / Cross (South) -> Flip / Good
    // 1: B / Circle (East) -> Again (1)
    // 2: X / Square (West) -> Hard (2)
    // 3: Y / Triangle (North) -> Easy (4)
    // 4: L1 / Left Shoulder -> Hint
    // 5: R1 / Right Shoulder -> Flip
    // 12: D-Pad Up -> Easy
    // 13: D-Pad Down -> Hard
    // 14: D-Pad Left -> Again
    // 15: D-Pad Right -> Good

    switch (index) {
      case 0:
        this.emitAction('flip');
        break;
      case 1:
        this.emitAction('again');
        break;
      case 2:
        this.emitAction('hard');
        break;
      case 3:
        this.emitAction('easy');
        break;
      case 4:
        this.emitAction('hint');
        break;
      case 5:
        this.emitAction('flip');
        break;
      case 12: // D-Pad Up
        this.emitAction('easy');
        break;
      case 13: // D-Pad Down
        this.emitAction('hard');
        break;
      case 14: // D-Pad Left
        this.emitAction('again');
        break;
      case 15: // D-Pad Right
        this.emitAction('good');
        break;
      default:
        break;
    }
  }

  private emitAction(action: GamepadAction) {
    this.actionListeners.forEach(listener => listener(action));
  }
}

export const gamepadService = GamepadService.getInstance();
