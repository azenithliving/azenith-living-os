"use client";

import { motion } from 'framer-motion';
import { Brain, ArrowRight, Database, Users, Shield, Zap } from 'lucide-react';

interface MirrorNode {
  id: string;
  label: string;
  type: 'data' | 'agent' | 'proposal';
  icon: any;
  color: string;
}

export function NeuralMirror({ activeProposal }: { activeProposal: any }) {
  if (!activeProposal) return (
    <div className="flex h-full items-center justify-center text-white/20 italic">
      في انتظار توليد مقترح لتفعيل المرآة العصبية...
    </div>
  );

  const nodes: MirrorNode[] = [
    { id: 'data-users', label: 'بيانات المستخدمين', type: 'data', icon: Users, color: 'text-blue-400' },
    { id: 'data-sections', label: 'هيكل الموقع', type: 'data', icon: Database, color: 'text-purple-400' },
    { id: 'agent-marketing', label: 'تحليل التسويق', type: 'agent', icon: Brain, color: 'text-blue-500' },
    { id: 'agent-ui', label: 'تحليل التصميم', type: 'agent', icon: Brain, color: 'text-purple-500' },
    { id: 'agent-security', label: 'تحليل الأمان', type: 'agent', icon: Shield, color: 'text-emerald-500' },
    { id: 'proposal', label: 'المقترح السيادي', type: 'proposal', icon: Zap, color: 'text-[#C5A059]' },
  ];

  return (
    <div className="relative h-[400px] w-full overflow-hidden rounded-xl border border-white/5 bg-black/20 p-6 backdrop-blur-sm">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(197,160,89,0.05),transparent_70%)]" />
      
      <div className="relative z-10 flex h-full items-center justify-center">
        {/* Central Proposal Node */}
        <motion.div 
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative z-20 flex flex-col items-center gap-2"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#C5A059] bg-black shadow-[0_0_30px_rgba(197,160,89,0.3)]">
            <Zap className="h-10 w-10 text-[#C5A059] animate-pulse" />
          </div>
          <span className="text-xs font-bold text-[#C5A059] text-center max-w-[120px]">
            {activeProposal.description.substring(0, 40)}...
          </span>
        </motion.div>

        {/* Orbiting Agent Nodes */}
        <div className="absolute inset-0 flex items-center justify-center">
          {[
            { angle: 0, node: nodes[2] },
            { angle: 120, node: nodes[3] },
            { angle: 240, node: nodes[4] },
          ].map((item, idx) => (
            <motion.div
              key={item.node.id}
              initial={{ opacity: 0 }}
              animate={{ 
                opacity: 1,
                x: Math.cos((item.angle * Math.PI) / 180) * 120,
                y: Math.sin((item.angle * Math.PI) / 180) * 120,
              }}
              className="absolute flex flex-col items-center gap-1"
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/80 ${item.node.color}`}>
                <item.node.icon className="h-6 w-6" />
              </div>
              <span className="text-[10px] text-white/50">{item.node.label}</span>
              
              {/* Connector line to center */}
              <div 
                className="absolute top-1/2 left-1/2 h-[1px] bg-gradient-to-r from-transparent to-white/20"
                style={{ 
                  width: '100px', 
                  transform: `rotate(${item.angle + 180}deg)`,
                  transformOrigin: 'left center'
                }}
              />
            </motion.div>
          ))}
        </div>

        {/* Data Layer (Outer) */}
        <div className="absolute inset-0 flex items-center justify-center">
          {[
            { angle: 60, node: nodes[0] },
            { angle: 300, node: nodes[1] },
          ].map((item) => (
            <motion.div
              key={item.node.id}
              initial={{ opacity: 0 }}
              animate={{ 
                opacity: 0.6,
                x: Math.cos((item.angle * Math.PI) / 180) * 180,
                y: Math.sin((item.angle * Math.PI) / 180) * 180,
              }}
              className="absolute flex flex-col items-center gap-1"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-white/10 bg-transparent ${item.node.color}`}>
                <item.node.icon className="h-4 w-4" />
              </div>
              <span className="text-[8px] text-white/30 uppercase tracking-tighter">{item.node.label}</span>
            </motion.div>
          ))}
        </div>
      </div>
      
      <div className="absolute bottom-4 left-6 right-6">
        <p className="text-[10px] text-center text-white/20 font-mono">
          NEURAL_CONSCIOUSNESS_MAPPING_v1.0.4 // REALTIME_REASONING_CHAIN
        </p>
      </div>
    </div>
  );
}
