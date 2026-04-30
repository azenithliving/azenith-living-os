import { NeuralCore } from '../services/neural-core';
import { roomDefinitions, seoDefinitions, packageLadder, aboutData } from '../lib/site-content';
import { ROOM_DESIGN_TIPS } from '../lib/room-design-tips';

/**
 * THE INGESTION PROTOCOL v1.0
 * This script migrates all corporate DNA and technical design expertise 
 * into the Neural Vault for the ASI to achieve total domain mastery.
 */
async function runIngestion() {
  console.log("🚀 Starting The Ingestion Protocol...");

  try {
    // 1. Ingest Room Definitions
    console.log("📦 Ingesting Room Definitions...");
    for (const room of roomDefinitions) {
      const content = `غرفة: ${room.title}. ملخص: ${room.summary}. المخرج النهائي: ${room.outcome}. المميزات: ${room.bullets.join(', ')}.`;
      await NeuralCore.ingestKnowledge(content, 'corporate_service', { slug: room.slug, type: 'room' });
      
      // Ingest Furniture within rooms
      for (const item of room.furniture) {
        const itemContent = `أثاث: ${item.title}. الوصف: ${item.description}. السعر: ${item.priceRange}. المميزات: ${item.features.join(', ')}.`;
        await NeuralCore.ingestKnowledge(itemContent, 'product_data', { slug: item.slug, parent_room: room.slug });
      }
    }

    // 2. Ingest Design Expertise (Tips)
    console.log("🎨 Ingesting Design Expertise...");
    for (const [roomType, styles] of Object.entries(ROOM_DESIGN_TIPS)) {
      for (const [styleName, tips] of Object.entries(styles)) {
        for (const tip of tips) {
          const tipContent = `نصيحة تصميمية لـ ${roomType} (${styleName}): ${tip.title}. المحتوى: ${tip.content}. الفئة: ${tip.category}.`;
          await NeuralCore.ingestKnowledge(tipContent, 'technical_expertise', { 
            tip_id: tip.id, 
            room_type: roomType, 
            style: styleName,
            category: tip.category
          });
        }
      }
    }

    // 3. Ingest Business Logic (Packages)
    console.log("💼 Ingesting Business Logic...");
    for (const pkg of packageLadder) {
      const pkgContent = `باقة خدمة: ${pkg.title}. السعر: ${pkg.price}. الملخص: ${pkg.summary}. المميزات: ${pkg.bullets.join(', ')}.`;
      await NeuralCore.ingestKnowledge(pkgContent, 'business_logic', { key: pkg.key });
    }

    // 4. Ingest Brand Identity
    console.log("🏛️ Ingesting Brand Identity...");
    const brandContent = `هوية أزينث ليفينج: ${aboutData.story}. القيم: ${aboutData.values.join(', ')}. الفريق: ${aboutData.team}.`;
    await NeuralCore.ingestKnowledge(brandContent, 'brand_identity', { category: 'about' });

    console.log("✅ Ingestion Protocol Complete. The ASI is now enlightened.");
  } catch (error) {
    console.error("❌ Ingestion Failed:", error);
  }
}

runIngestion();
