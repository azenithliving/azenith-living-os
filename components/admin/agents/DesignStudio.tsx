'use client';

import { useState } from 'react';
import { imageGeneration } from '@/services/image-generation';
import { localLLM } from '@/services/local-llm';

export function DesignStudio() {
  const [style, setStyle] = useState('modern');
  const [roomType, setRoomType] = useState('living room');
  const [dimensions, setDimensions] = useState('2m x 1.5m');
  const [materials, setMaterials] = useState(['wood', 'fabric']);
  const [colorScheme, setColorScheme] = useState('warm');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{
    design_url: string;
    description: string;
    improvements: string[];
  } | null>(null);
  
  async function generateDesign() {
    setGenerating(true);
    
    try {
      // توليد الصورة
      const imageResult = await imageGeneration.generateFurnitureDesign(
        style,
        roomType,
        dimensions,
        materials,
        colorScheme
      );
      
      // الحصول على اقتراحات تحسين
      const improvements = await localLLM.suggestDesignImprovements(
        imageResult.description
      );
      
      setResult({
        design_url: imageResult.design_url,
        description: imageResult.description,
        improvements
      });
    } catch (err) {
      console.error('Design generation failed:', err);
    }
    
    setGenerating(false);
  }
  
  const toggleMaterial = (mat: string) => {
    if (materials.includes(mat)) {
      setMaterials(materials.filter(m => m !== mat));
    } else {
      setMaterials([...materials, mat]);
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4">استوديو التصميم بالذكاء الاصطناعي (PRIME)</h2>
      
      {/* Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Style */}
        <div>
          <label className="block text-sm font-medium mb-1">الستايل</label>
          <select 
            value={style} 
            onChange={(e) => setStyle(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500"
          >
            <option value="modern">مودرن</option>
            <option value="classic">كلاسيك</option>
            <option value="minimalist">مينيماليست</option>
            <option value="industrial">صناعي</option>
            <option value="bohemian">بوهيمي</option>
            <option value="scandinavian">اسكندنافي</option>
          </select>
        </div>
        
        {/* Room Type */}
        <div>
          <label className="block text-sm font-medium mb-1">نوع الغرفة</label>
          <select
            value={roomType}
            onChange={(e) => setRoomType(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500"
          >
            <option value="living room">غرفة معيشة</option>
            <option value="bedroom">غرفة نوم</option>
            <option value="dining room">غرفة طعام</option>
            <option value="office">مكتب</option>
            <option value="kitchen">مطبخ</option>
            <option value="outdoor">خارجي</option>
          </select>
        </div>
        
        {/* Dimensions */}
        <div>
          <label className="block text-sm font-medium mb-1">المقاسات (العرض x العمق)</label>
          <input
            type="text"
            value={dimensions}
            onChange={(e) => setDimensions(e.target.value)}
            placeholder="مثال: 2m x 1.5m"
            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500"
          />
        </div>
        
        {/* Color Scheme */}
        <div>
          <label className="block text-sm font-medium mb-1">الألوان</label>
          <select
            value={colorScheme}
            onChange={(e) => setColorScheme(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500"
          >
            <option value="warm">دافئة (بني، بيج)</option>
            <option value="cool">باردة (رمادي، أزرق)</option>
            <option value="neutral">محايدة (أبيض، أسود)</option>
            <option value="vibrant">حيوية (أحمر، أصفر)</option>
            <option value="pastel">باستيل (فاتحة)</option>
          </select>
        </div>
      </div>
      
      {/* Materials */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">الخامات</label>
        <div className="flex flex-wrap gap-2">
          {['wood', 'metal', 'fabric', 'leather', 'glass', 'marble', 'plastic'].map((mat) => (
            <label key={mat} className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={materials.includes(mat)}
                onChange={() => toggleMaterial(mat)}
                className="rounded text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm capitalize">
                {mat === 'wood' ? 'خشب' :
                 mat === 'metal' ? 'معدن' :
                 mat === 'fabric' ? 'قماش' :
                 mat === 'leather' ? 'جلد' :
                 mat === 'glass' ? 'زجاج' :
                 mat === 'marble' ? 'رخام' :
                 mat === 'plastic' ? 'بلاستيك' : mat}
              </span>
            </label>
          ))}
        </div>
      </div>
      
      {/* Generate Button */}
      <button
        onClick={generateDesign}
        disabled={generating || materials.length === 0}
        className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 
          disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors
          flex items-center justify-center gap-2"
      >
        {generating ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            جاري التوليد بالذكاء الاصطناعي...
          </>
        ) : (
          <>
            <span>⚡</span>
            توليد التصميم
          </>
        )}
      </button>
      
      {/* Result */}
      {result && (
        <div className="mt-6 space-y-4">
          {/* Image */}
          <div className="relative rounded-lg overflow-hidden bg-gray-100">
            <img 
              src={result.design_url} 
              alt="Generated design" 
              className="w-full h-64 object-contain"
            />
            <div className="absolute top-2 right-2 px-2 py-1 bg-purple-600 text-white text-xs rounded">
              AI Generated
            </div>
          </div>
          
          {/* Description */}
          <p className="text-sm text-gray-600">{result.description}</p>
          
          {/* AI Suggestions */}
          {result.improvements.length > 0 && (
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="font-semibold text-sm mb-2">💡 اقتراحات PRIME للتحسين:</p>
              <ul className="text-sm list-disc list-inside space-y-1">
                {result.improvements.map((imp, i) => (
                  <li key={i}>{imp}</li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Actions */}
          <div className="flex gap-2">
            <button className="flex-1 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors">
              ✓ موافقة
            </button>
            <button className="flex-1 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors">
              🔄 تعديل
            </button>
            <button 
              onClick={() => setResult(null)}
              className="flex-1 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            >
              ✕ إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
