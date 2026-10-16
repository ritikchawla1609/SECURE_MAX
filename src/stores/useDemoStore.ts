import { create } from 'zustand';

export type SystemState = 'NORMAL' | 'ELEVATED' | 'INCIDENT' | 'CONTAINMENT' | 'RECOVERED';

export type AttackPathStage = 'IDLE' | 'IDENTITY' | 'SESSION' | 'RBAC' | 'DOMAIN1' | 'DOMAIN2' | 'KMS' | 'DECRYPTION' | 'BLOCKED' | 'INCIDENT_CREATED';

export interface ThreatEvent {
  id: string;
  type: string;
  name: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  blockedAt: AttackPathStage;
  timestamp: Date;
}

export interface Incident {
  id: string;
  threatId: string;
  title: string;
  severity: string;
  status: 'OPEN' | 'INVESTIGATING' | 'CONTAINED' | 'THREAT CONTAINED';
  createdAt: Date;
  detectionLayer: string;
  blockedLayer: string;
  affectedAsset: string;
  source: string;
}

interface DemoState {
  systemState: SystemState;
  postureScore: number;
  activeThreat: ThreatEvent | null;
  attackPathStage: AttackPathStage;
  incidents: Incident[];
  presentationModeActive: boolean;
  presentationStage: number;

  // Actions
  setSystemState: (state: SystemState) => void;
  setPostureScore: (score: number) => void;
  startSimulation: (threat: Omit<ThreatEvent, 'timestamp' | 'id'>) => void;
  advanceAttackPath: (stage: AttackPathStage) => void;
  createIncident: (incident: Omit<Incident, 'id' | 'createdAt'>) => void;
  resolveIncident: (id: string) => void;
  resolvePresentationIncidents: () => void;
  resetDemo: () => void;
  
  // Presentation Controller
  setPresentationMode: (active: boolean) => void;
  setPresentationStage: (stage: number) => void;
}

export const useDemoStore = create<DemoState>((set, get) => ({
  systemState: 'NORMAL',
  postureScore: 98,
  activeThreat: null,
  attackPathStage: 'IDLE',
  incidents: [],
  presentationModeActive: false,
  presentationStage: 0,

  setSystemState: (state) => set({ systemState: state }),
  setPostureScore: (score) => set({ postureScore: score }),
  
  startSimulation: (threat) => {
    const newThreat: ThreatEvent = {
      ...threat,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };
    set({ 
      activeThreat: newThreat, 
      attackPathStage: 'IDENTITY',
      systemState: 'ELEVATED'
    });
  },

  advanceAttackPath: (stage) => set({ attackPathStage: stage }),
  
  createIncident: (incidentData) => {
    const newIncident: Incident = {
      ...incidentData,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    };
    set((state) => {
      // Idempotency: Prevent duplicate incidents with the same threatId
      if (incidentData.threatId && state.incidents.some(i => i.threatId === incidentData.threatId)) {
        return state;
      }
      return { 
        incidents: [newIncident, ...state.incidents],
        systemState: 'INCIDENT'
      };
    });
  },

  resolveIncident: (id) => {
    set((state) => ({
      incidents: state.incidents.map(i => 
        (i.id === id || i.threatId === id || id === 'all') 
          ? { ...i, status: 'THREAT CONTAINED' } 
          : i
      ),
      systemState: 'RECOVERED',
      activeThreat: null,
      attackPathStage: 'IDLE'
    }));
    setTimeout(() => {
      set({ systemState: 'NORMAL', postureScore: 98 });
    }, 3000);
  },

  resolvePresentationIncidents: () => {
    set((state) => ({
      incidents: state.incidents.map(i => 
        (i.threatId === 'presentation-sim-1' || i.threatId?.startsWith('sim-') || i.source?.includes('SANDBOX')) 
          ? { ...i, status: 'THREAT CONTAINED' } 
          : i
      ),
      systemState: 'RECOVERED',
      activeThreat: null,
      attackPathStage: 'IDLE'
    }));
    setTimeout(() => {
      set({ systemState: 'NORMAL', postureScore: 98 });
    }, 3000);
  },

  resetDemo: () => set({
    systemState: 'NORMAL',
    postureScore: 98,
    activeThreat: null,
    attackPathStage: 'IDLE',
    incidents: [],
    presentationModeActive: false,
    presentationStage: 0
  }),

  setPresentationMode: (active) => set({ presentationModeActive: active, presentationStage: 0 }),
  setPresentationStage: (stage) => set({ presentationStage: stage })
}));
