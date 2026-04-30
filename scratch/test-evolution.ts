import { EventBus } from '../aaca/events/event-bus';
import { EvolutionAgentService } from '../aaca/agents/evolution-agent-service';
import { Logger } from '../aaca/utils/logger';

async function testEvolution() {
  const logger = new Logger('Test');
  const eventBus = new EventBus({ redisUrl: 'redis://localhost:6379' } as any);
  const evolutionAgent = new EvolutionAgentService(eventBus);
  
  console.log('--- [فحص وكيل التطور: تحليل النظام] ---');
  const analysis = await evolutionAgent.analyzeSystemForImprovements({});
  
  console.log('فرص التحسين المكتشفة:');
  analysis.opportunities.forEach((opp, i) => {
    console.log(`${i+1}. المنطقة: ${opp.area}`);
    console.log(`   الوضع الحالي: ${opp.currentState}`);
    console.log(`   التحسين المقترح: ${opp.proposedImprovement}`);
    console.log(`   الأولوية: ${opp.priority}`);
  });

  console.log('\nتوصيات الوكيل العامة:');
  analysis.recommendations.forEach(r => console.log(`- ${r}`));
}

testEvolution().catch(console.error);
