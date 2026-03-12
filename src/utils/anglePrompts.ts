/**
 * Product Angle Creator — Shot Definitions + Prompt Templates
 *
 * ~130 shots across 8 categories for comprehensive product photography.
 * Each template uses @img1 as the Freepik reference image placeholder.
 */

export interface AngleShot {
  id: string;
  label: string;
  category: 'rotation' | 'elevation' | 'closeup' | 'lighting' | 'surface' | 'lifestyle' | 'creative' | 'composition';
  promptTemplate: string;
}

export interface AngleCategory {
  key: AngleShot['category'];
  label: string;
  color: string;
}

export const ANGLE_CATEGORIES: AngleCategory[] = [
  { key: 'rotation',    label: 'Rotation',     color: 'blue' },
  { key: 'elevation',   label: 'Elevation',    color: 'amber' },
  { key: 'closeup',     label: 'Close-Up',     color: 'rose' },
  { key: 'lighting',    label: 'Lighting',     color: 'violet' },
  { key: 'surface',     label: 'Surface',      color: 'orange' },
  { key: 'lifestyle',   label: 'Lifestyle',    color: 'cyan' },
  { key: 'creative',    label: 'Creative',     color: 'emerald' },
  { key: 'composition', label: 'Composition',  color: 'fuchsia' },
];

export const ANGLE_SHOTS: AngleShot[] = [

  // ═══════════════════════════════════════════════
  // ── ROTATION (horizontal orbit, 18 shots) ──
  // ═══════════════════════════════════════════════

  { id: 'rot-front',       label: 'Front (0°)',           category: 'rotation',
    promptTemplate: '@img1 product, front facing straight-on view, 0 degree rotation, eye level, centered, clean studio background, commercial product photography, sharp focus' },
  { id: 'rot-15r',         label: 'Slight Right (15°)',   category: 'rotation',
    promptTemplate: '@img1 product, subtle 15 degree turn to the right from front, adds depth and dimension, studio lighting, product photography' },
  { id: 'rot-15l',         label: 'Slight Left (15°)',    category: 'rotation',
    promptTemplate: '@img1 product, subtle 15 degree turn to the left from front, adds depth and dimension, studio lighting, product photography' },
  { id: 'rot-30r',         label: '30° Right',            category: 'rotation',
    promptTemplate: '@img1 product, 30 degree rotation to the right, partial front and side visible, studio lighting, product photography' },
  { id: 'rot-30l',         label: '30° Left',             category: 'rotation',
    promptTemplate: '@img1 product, 30 degree rotation to the left, partial front and side visible, studio lighting, product photography' },
  { id: 'rot-3q-r',        label: '3/4 Front Right (45°)', category: 'rotation',
    promptTemplate: '@img1 product, classic three-quarter front right view, 45 degree rotation, studio lighting, product photography, sharp detail' },
  { id: 'rot-3q-l',        label: '3/4 Front Left (45°)',  category: 'rotation',
    promptTemplate: '@img1 product, classic three-quarter front left view, 45 degree rotation, studio lighting, product photography, sharp detail' },
  { id: 'rot-60r',         label: '60° Right',            category: 'rotation',
    promptTemplate: '@img1 product, 60 degree rotation to the right, mostly side with some front, studio lighting, product photography' },
  { id: 'rot-60l',         label: '60° Left',             category: 'rotation',
    promptTemplate: '@img1 product, 60 degree rotation to the left, mostly side with some front, studio lighting, product photography' },
  { id: 'rot-side-r',      label: 'Right Profile (90°)',  category: 'rotation',
    promptTemplate: '@img1 product, exact right side profile view, 90 degree rotation, clean silhouette, studio background, product photography' },
  { id: 'rot-side-l',      label: 'Left Profile (90°)',   category: 'rotation',
    promptTemplate: '@img1 product, exact left side profile view, 90 degree rotation, clean silhouette, studio background, product photography' },
  { id: 'rot-120r',        label: '120° Right',           category: 'rotation',
    promptTemplate: '@img1 product, 120 degree rotation to the right, mostly back with some side visible, studio lighting, product photography' },
  { id: 'rot-120l',        label: '120° Left',            category: 'rotation',
    promptTemplate: '@img1 product, 120 degree rotation to the left, mostly back with some side visible, studio lighting, product photography' },
  { id: 'rot-3q-rear-r',   label: '3/4 Rear Right (135°)', category: 'rotation',
    promptTemplate: '@img1 product, three-quarter rear right view, 135 degree rotation, showing back and right side, studio lighting, product photography' },
  { id: 'rot-3q-rear-l',   label: '3/4 Rear Left (135°)',  category: 'rotation',
    promptTemplate: '@img1 product, three-quarter rear left view, 135 degree rotation, showing back and left side, studio lighting, product photography' },
  { id: 'rot-rear',        label: 'Back (180°)',          category: 'rotation',
    promptTemplate: '@img1 product, full rear back view, 180 degree rotation, showing back label information panel, studio background, product photography' },
  { id: 'rot-210r',        label: '210° Right',           category: 'rotation',
    promptTemplate: '@img1 product, 210 degree rotation, back-left perspective, showing rear and left side, studio lighting, product photography' },
  { id: 'rot-330l',        label: '330° Left',            category: 'rotation',
    promptTemplate: '@img1 product, 330 degree rotation, near-front with slight left turn, barely off-center, studio lighting, product photography' },

  // ═══════════════════════════════════════════════
  // ── ELEVATION (vertical angles, 14 shots) ──
  // ═══════════════════════════════════════════════

  { id: 'elev-eye',        label: 'Eye Level (0°)',       category: 'elevation',
    promptTemplate: '@img1 product, perfectly eye level straight-on, no vertical angle, clean studio, commercial product photography' },
  { id: 'elev-10up',       label: 'Slight High (10°)',    category: 'elevation',
    promptTemplate: '@img1 product, barely elevated 10 degree angle, subtle overhead perspective, natural viewing angle, product photography' },
  { id: 'elev-20up',       label: 'Moderate High (20°)',  category: 'elevation',
    promptTemplate: '@img1 product, 20 degree overhead angle, shows top surface beginning to appear, studio lighting, product photography' },
  { id: 'elev-30up',       label: 'Hero Angle (30°)',     category: 'elevation',
    promptTemplate: '@img1 product, hero shot from 30 degrees above, premium aspirational angle, commercial product photography' },
  { id: 'elev-45up',       label: '45° Down',             category: 'elevation',
    promptTemplate: '@img1 product, 45 degree overhead angle, classic three-quarter top view, shows top and front, studio lighting, product photography' },
  { id: 'elev-60up',       label: '60° Overhead',         category: 'elevation',
    promptTemplate: '@img1 product, 60 degree overhead angle, mostly top with some front visible, studio lighting, product photography' },
  { id: 'elev-75up',       label: 'Near Top-Down (75°)',  category: 'elevation',
    promptTemplate: '@img1 product, steep 75 degree overhead angle, nearly top-down with slight perspective, product photography' },
  { id: 'elev-topdown',    label: 'Top Down (90°)',       category: 'elevation',
    promptTemplate: '@img1 product, aerial top-down flat lay view, looking straight down 90 degrees, clean surface, product photography' },
  { id: 'elev-low10',      label: 'Slight Low (-10°)',    category: 'elevation',
    promptTemplate: '@img1 product, slightly below eye level, subtle low angle, adds presence and stature, product photography' },
  { id: 'elev-low30',      label: 'Low Angle (-30°)',     category: 'elevation',
    promptTemplate: '@img1 product, low angle shot 30 degrees below eye level looking upward, dramatic perspective, product photography' },
  { id: 'elev-low60',      label: 'Very Low (-60°)',      category: 'elevation',
    promptTemplate: '@img1 product, very low angle 60 degrees below, extreme upward perspective, towering imposing look, product photography' },
  { id: 'elev-worms',      label: "Worm's Eye (-90°)",    category: 'elevation',
    promptTemplate: '@img1 product, extreme worms eye view looking straight up from below, dramatic underside perspective, product photography' },
  { id: 'elev-dutch',      label: 'Dutch Tilt (20°)',     category: 'elevation',
    promptTemplate: '@img1 product, dutch angle tilted 20 degrees, dynamic off-kilter perspective, energetic modern product photography' },
  { id: 'elev-dutch-rev',  label: 'Reverse Dutch (-20°)', category: 'elevation',
    promptTemplate: '@img1 product, reverse dutch angle tilted negative 20 degrees opposite direction, dynamic asymmetric, product photography' },

  // ═══════════════════════════════════════════════
  // ── CLOSE-UP (detail shots, 16 shots) ──
  // ═══════════════════════════════════════════════

  { id: 'cu-macro',        label: 'Macro Texture',        category: 'closeup',
    promptTemplate: '@img1 product, extreme macro close-up of surface texture, every grain and detail visible, shallow depth of field, product photography' },
  { id: 'cu-label',        label: 'Label / Logo',         category: 'closeup',
    promptTemplate: '@img1 product, close-up focused on label branding or logo, sharp text, shallow background blur, product photography' },
  { id: 'cu-cap',          label: 'Cap / Closure',        category: 'closeup',
    promptTemplate: '@img1 product, close-up of opening cap lid or closure mechanism, detail shot, functional highlight, product photography' },
  { id: 'cu-edge',         label: 'Edge / Rim',           category: 'closeup',
    promptTemplate: '@img1 product, close-up of edge profile and rim detail, showing craftsmanship and finish, shallow depth of field' },
  { id: 'cu-tight',        label: 'Tight Crop',           category: 'closeup',
    promptTemplate: '@img1 product, extreme tight crop filling entire frame, no background visible, abstract detail, dramatic product photography' },
  { id: 'cu-half',         label: 'Half Frame',           category: 'closeup',
    promptTemplate: '@img1 product, cropped to show only half the product, artistic cut-off at center, negative space, modern composition' },
  { id: 'cu-cross',        label: 'Cross Section',        category: 'closeup',
    promptTemplate: '@img1 product, cross-section cutaway view showing inside contents and layers, educational diagram style, product photography' },
  { id: 'cu-bottom',       label: 'Bottom View',          category: 'closeup',
    promptTemplate: '@img1 product, view of product bottom showing base details and underside, unique perspective, product photography' },
  { id: 'cu-nozzle',       label: 'Nozzle / Dispenser',   category: 'closeup',
    promptTemplate: '@img1 product, extreme close-up of nozzle dispenser tip or applicator, functional detail, product photography' },
  { id: 'cu-material',     label: 'Material / Finish',    category: 'closeup',
    promptTemplate: '@img1 product, close-up highlighting material quality and surface finish, matte glossy metallic texture, product photography' },
  { id: 'cu-typography',   label: 'Typography Detail',    category: 'closeup',
    promptTemplate: '@img1 product, close-up of printed text and typography on packaging, crisp font details, product photography' },
  { id: 'cu-seal',         label: 'Seal / Packaging',     category: 'closeup',
    promptTemplate: '@img1 product, close-up of packaging seal tamper-evident feature, quality assurance detail, product photography' },
  { id: 'cu-corner',       label: 'Corner Detail',        category: 'closeup',
    promptTemplate: '@img1 product, extreme close-up of corner or joint where surfaces meet, construction detail, product photography' },
  { id: 'cu-emboss',       label: 'Embossing / Deboss',   category: 'closeup',
    promptTemplate: '@img1 product, close-up of embossed or debossed detail, raking light to show depth, tactile texture, product photography' },
  { id: 'cu-pour',         label: 'Pour / Squeeze',       category: 'closeup',
    promptTemplate: '@img1 product, action close-up of product being poured or squeezed out, contents visible, dynamic moment, product photography' },
  { id: 'cu-ingredient',   label: 'Ingredient Peek',      category: 'closeup',
    promptTemplate: '@img1 product, close-up showing product contents or ingredients visible through packaging, transparency detail, product photography' },

  // ═══════════════════════════════════════════════
  // ── LIGHTING (setups, 18 shots) ──
  // ═══════════════════════════════════════════════

  { id: 'lit-studio',      label: 'Studio White',         category: 'lighting',
    promptTemplate: '@img1 product, bright studio white background, even diffused lighting, commercial catalog photography, clean professional' },
  { id: 'lit-dramatic',    label: 'Dramatic Shadow',      category: 'lighting',
    promptTemplate: '@img1 product, dramatic side lighting, deep black shadows, moody dark background, chiaroscuro, product photography' },
  { id: 'lit-window',      label: 'Window Light',         category: 'lighting',
    promptTemplate: '@img1 product, natural window light from side, soft shadows, warm tones, lifestyle photography feel' },
  { id: 'lit-backlit',     label: 'Backlit Rim',          category: 'lighting',
    promptTemplate: '@img1 product, backlit rim lighting, glowing bright edges, silhouette effect, cinematic, product photography' },
  { id: 'lit-golden',      label: 'Golden Hour',          category: 'lighting',
    promptTemplate: '@img1 product, golden hour warm sunlight, long amber shadows, outdoor warmth, product photography' },
  { id: 'lit-neon',        label: 'Neon / Color Gel',     category: 'lighting',
    promptTemplate: '@img1 product, neon colored gel lighting, vibrant pink and blue tones, contemporary, edgy product photography' },
  { id: 'lit-soft',        label: 'Soft Diffused',        category: 'lighting',
    promptTemplate: '@img1 product, ultra soft diffused lighting, no hard shadows, ethereal glow, beauty product photography style' },
  { id: 'lit-spot',        label: 'Single Spotlight',     category: 'lighting',
    promptTemplate: '@img1 product, single focused spotlight from above, dark surroundings, pool of light, theatrical, product photography' },
  { id: 'lit-split',       label: 'Split Light',          category: 'lighting',
    promptTemplate: '@img1 product, split lighting half in light half in shadow, dramatic two-tone effect, product photography' },
  { id: 'lit-butterfly',   label: 'Butterfly / Paramount', category: 'lighting',
    promptTemplate: '@img1 product, butterfly lighting from directly above front, small shadow beneath, glamorous beauty product photography' },
  { id: 'lit-rembrandt',   label: 'Rembrandt',            category: 'lighting',
    promptTemplate: '@img1 product, Rembrandt lighting triangle of light on shadow side, classic moody painterly, product photography' },
  { id: 'lit-cross',       label: 'Cross Light',          category: 'lighting',
    promptTemplate: '@img1 product, cross lighting from two opposite sides, dramatic edge definition, both sides illuminated, product photography' },
  { id: 'lit-underlit',    label: 'Bottom / Under Lit',   category: 'lighting',
    promptTemplate: '@img1 product, lit from below underneath, eerie dramatic uplighting, dark ceiling, unusual product photography' },
  { id: 'lit-ring',        label: 'Ring Light',           category: 'lighting',
    promptTemplate: '@img1 product, ring light even frontal illumination, circular catchlight, beauty product photography, flattering' },
  { id: 'lit-highkey',     label: 'High Key',             category: 'lighting',
    promptTemplate: '@img1 product, high key lighting, very bright, minimal shadows, airy white feel, clean commercial product photography' },
  { id: 'lit-lowkey',      label: 'Low Key',              category: 'lighting',
    promptTemplate: '@img1 product, low key lighting, mostly dark, selective highlights, moody atmospheric, luxury product photography' },
  { id: 'lit-silhouette',  label: 'Silhouette',           category: 'lighting',
    promptTemplate: '@img1 product, pure silhouette against bright background, shape outline only, dramatic minimal product photography' },
  { id: 'lit-gradient',    label: 'Gradient Backdrop',    category: 'lighting',
    promptTemplate: '@img1 product, smooth color gradient background transitioning warm to cool, editorial product photography, contemporary' },

  // ═══════════════════════════════════════════════
  // ── SURFACE (materials & textures, 16 shots) ──
  // ═══════════════════════════════════════════════

  { id: 'surf-marble',     label: 'Marble',               category: 'surface',
    promptTemplate: '@img1 product, placed on elegant white marble surface, luxury feel, minimal styling, product photography, sophisticated' },
  { id: 'surf-wood-light', label: 'Light Wood',           category: 'surface',
    promptTemplate: '@img1 product, on light natural oak wood surface, Scandinavian minimal feel, warm tones, product photography' },
  { id: 'surf-wood-dark',  label: 'Dark Wood',            category: 'surface',
    promptTemplate: '@img1 product, on dark walnut wood surface, rich tones, premium luxury feel, product photography' },
  { id: 'surf-concrete',   label: 'Concrete',             category: 'surface',
    promptTemplate: '@img1 product, on raw concrete surface, industrial minimal aesthetic, urban texture, product photography' },
  { id: 'surf-glass',      label: 'Glass',                category: 'surface',
    promptTemplate: '@img1 product, on clear glass surface, transparent reflections, modern clean, product photography' },
  { id: 'surf-mirror',     label: 'Mirror',               category: 'surface',
    promptTemplate: '@img1 product, on reflective mirror surface, perfect reflection below, dark background, luxury product photography' },
  { id: 'surf-metal',      label: 'Brushed Metal',        category: 'surface',
    promptTemplate: '@img1 product, on brushed stainless steel metal surface, industrial modern, cool tones, product photography' },
  { id: 'surf-fabric',     label: 'Linen / Fabric',       category: 'surface',
    promptTemplate: '@img1 product, on draped natural linen fabric, soft wrinkles, organic texture, lifestyle product photography' },
  { id: 'surf-velvet',     label: 'Velvet',               category: 'surface',
    promptTemplate: '@img1 product, on rich dark velvet fabric surface, luxury premium feel, deep texture, product photography' },
  { id: 'surf-sand',       label: 'Sand',                 category: 'surface',
    promptTemplate: '@img1 product, on fine sand surface, beach coastal feel, natural warm tones, outdoor product photography' },
  { id: 'surf-stone',      label: 'Natural Stone',        category: 'surface',
    promptTemplate: '@img1 product, on rough natural stone slab, organic earthy texture, grounded feel, product photography' },
  { id: 'surf-terrazzo',   label: 'Terrazzo',             category: 'surface',
    promptTemplate: '@img1 product, on terrazzo surface with colored stone chips, contemporary design, product photography' },
  { id: 'surf-leather',    label: 'Leather',              category: 'surface',
    promptTemplate: '@img1 product, on premium leather surface, rich grain texture, luxury masculine feel, product photography' },
  { id: 'surf-paper',      label: 'Textured Paper',       category: 'surface',
    promptTemplate: '@img1 product, on textured kraft paper surface, artisanal handmade feel, warm neutral tones, product photography' },
  { id: 'surf-leaves',     label: 'Green Leaves',         category: 'surface',
    promptTemplate: '@img1 product, resting on fresh green tropical leaves, natural botanical, organic vibrant, product photography' },
  { id: 'surf-water',      label: 'Shallow Water',        category: 'surface',
    promptTemplate: '@img1 product, sitting in shallow clear water with ripples, refreshing aquatic feel, product photography' },

  // ═══════════════════════════════════════════════
  // ── LIFESTYLE (context & in-use, 16 shots) ──
  // ═══════════════════════════════════════════════

  { id: 'life-hand',       label: 'Held in Hand',         category: 'lifestyle',
    promptTemplate: '@img1 product, held in a hand showing real scale, human interaction, lifestyle product photography, natural grip' },
  { id: 'life-shelf',      label: 'On Shelf',             category: 'lifestyle',
    promptTemplate: '@img1 product, displayed on a styled shelf among curated objects, shelfie aesthetic, interior product photography' },
  { id: 'life-bathroom',   label: 'Bathroom Counter',     category: 'lifestyle',
    promptTemplate: '@img1 product, on bathroom counter near sink, morning routine setting, lifestyle product photography, real context' },
  { id: 'life-vanity',     label: 'Vanity / Dresser',     category: 'lifestyle',
    promptTemplate: '@img1 product, on vanity dresser with mirror and accessories, beauty routine context, lifestyle photography' },
  { id: 'life-desk',       label: 'On Desk',              category: 'lifestyle',
    promptTemplate: '@img1 product, on clean modern desk workspace, laptop and stationery nearby, productivity lifestyle photography' },
  { id: 'life-kitchen',    label: 'Kitchen Counter',      category: 'lifestyle',
    promptTemplate: '@img1 product, on kitchen counter with cutting board and fresh ingredients, culinary context, lifestyle photography' },
  { id: 'life-bag',        label: 'In Bag / Pouch',       category: 'lifestyle',
    promptTemplate: '@img1 product, peeking out of a stylish bag or travel pouch, on-the-go lifestyle, product photography' },
  { id: 'life-bedside',    label: 'Bedside Table',        category: 'lifestyle',
    promptTemplate: '@img1 product, on bedside nightstand, cozy evening routine setting, warm lamp light, lifestyle photography' },
  { id: 'life-outdoor',    label: 'Outdoor Picnic',       category: 'lifestyle',
    promptTemplate: '@img1 product, on picnic blanket outdoors, grass visible, sunny relaxed setting, outdoor lifestyle photography' },
  { id: 'life-beach',      label: 'Beach Setting',        category: 'lifestyle',
    promptTemplate: '@img1 product, at the beach on towel with ocean background, summer vacation feel, lifestyle product photography' },
  { id: 'life-gym',        label: 'Gym / Fitness',        category: 'lifestyle',
    promptTemplate: '@img1 product, in gym setting with workout equipment background, active fitness lifestyle, product photography' },
  { id: 'life-cafe',       label: 'Cafe Table',           category: 'lifestyle',
    promptTemplate: '@img1 product, on cafe table with coffee cup nearby, urban lifestyle, warm tones, product photography' },
  { id: 'life-travel',     label: 'Travel / Suitcase',    category: 'lifestyle',
    promptTemplate: '@img1 product, next to open suitcase or travel bag, travel lifestyle context, adventure feel, product photography' },
  { id: 'life-gift',       label: 'Gift / Unboxing',      category: 'lifestyle',
    promptTemplate: '@img1 product, being unboxed from premium packaging, gift reveal moment, hands opening box, product photography' },
  { id: 'life-routine',    label: 'Morning Routine',      category: 'lifestyle',
    promptTemplate: '@img1 product, in a morning routine flat lay with towel coffee skincare items, lifestyle editorial, product photography' },
  { id: 'life-window',     label: 'Window Sill',          category: 'lifestyle',
    promptTemplate: '@img1 product, on window sill with soft natural light streaming in, plants nearby, cozy lifestyle photography' },

  // ═══════════════════════════════════════════════
  // ── CREATIVE (artistic & unique, 18 shots) ──
  // ═══════════════════════════════════════════════

  { id: 'cre-floating',    label: 'Floating',             category: 'creative',
    promptTemplate: '@img1 product, floating levitating in mid-air, no surface, clean gradient background, gravity-defying, product photography' },
  { id: 'cre-splash',      label: 'Water Splash',         category: 'creative',
    promptTemplate: '@img1 product, dynamic water splash explosion around product, frozen motion, high speed photography, dramatic' },
  { id: 'cre-decon',       label: 'Deconstructed',        category: 'creative',
    promptTemplate: '@img1 product, deconstructed with ingredients or components arranged around it, exploded view, editorial product photography' },
  { id: 'cre-motion',      label: 'Motion Blur',          category: 'creative',
    promptTemplate: '@img1 product, motion blur on background with sharp product, sense of speed and energy, dynamic photography' },
  { id: 'cre-shadow',      label: 'Shadow Play',          category: 'creative',
    promptTemplate: '@img1 product, dramatic long cast shadow creating artistic pattern, overhead hard light, shadow as design element' },
  { id: 'cre-dblexp',      label: 'Double Exposure',      category: 'creative',
    promptTemplate: '@img1 product, double exposure effect blending product with natural elements like leaves flowers, artistic overlay' },
  { id: 'cre-lineup',      label: 'Lineup / Row',         category: 'creative',
    promptTemplate: '@img1 product, multiple identical products in a row receding into distance, lineup perspective, depth, commercial photography' },
  { id: 'cre-smoke',       label: 'Smoke / Mist',         category: 'creative',
    promptTemplate: '@img1 product, surrounded by atmospheric smoke or mist, mysterious ethereal mood, dramatic product photography' },
  { id: 'cre-ice',         label: 'Frozen / Ice',         category: 'creative',
    promptTemplate: '@img1 product, encased in or surrounded by ice crystals and frost, frozen cold sensation, product photography' },
  { id: 'cre-fire',        label: 'Fire / Embers',        category: 'creative',
    promptTemplate: '@img1 product, surrounded by warm fire embers sparks, intense heat energy feel, dramatic product photography' },
  { id: 'cre-flower',      label: 'Floral Arrangement',   category: 'creative',
    promptTemplate: '@img1 product, surrounded by beautiful fresh flowers and petals, botanical editorial, feminine elegant product photography' },
  { id: 'cre-colorpow',    label: 'Color Powder',         category: 'creative',
    promptTemplate: '@img1 product, color powder explosion Holi festival style, vibrant particles in air, dynamic energy product photography' },
  { id: 'cre-hanging',     label: 'Suspended / Hanging',  category: 'creative',
    promptTemplate: '@img1 product, suspended by invisible thread hanging in mid-air, gravity defying, clean background, product photography' },
  { id: 'cre-stack',       label: 'Stacked / Pyramid',    category: 'creative',
    promptTemplate: '@img1 product, multiple units stacked in pyramid formation, abundance display, commercial product photography' },
  { id: 'cre-bokeh',       label: 'Bokeh Background',     category: 'creative',
    promptTemplate: '@img1 product, sharp product with beautiful circular bokeh lights in background, dreamy out of focus, product photography' },
  { id: 'cre-paint',       label: 'Paint Drip',           category: 'creative',
    promptTemplate: '@img1 product, with colorful paint dripping or splashing on it, artistic creative mess, bold product photography' },
  { id: 'cre-shatter',     label: 'Shatter / Fragment',   category: 'creative',
    promptTemplate: '@img1 product, shattering fragmenting into pieces, explosive energy, surreal dynamic, product photography' },
  { id: 'cre-miniature',   label: 'Miniature World',      category: 'creative',
    promptTemplate: '@img1 product, giant product in miniature world with tiny people and buildings, forced perspective, whimsical product photography' },

  // ═══════════════════════════════════════════════
  // ── COMPOSITION (framing & layout, 14 shots) ──
  // ═══════════════════════════════════════════════

  { id: 'comp-centered',   label: 'Centered Minimal',     category: 'composition',
    promptTemplate: '@img1 product, perfectly centered, symmetrical, maximum negative space around product, ultra minimal, product photography' },
  { id: 'comp-rule-l',     label: 'Rule of Thirds Left',  category: 'composition',
    promptTemplate: '@img1 product, positioned left third of frame, large negative space on right for text overlay, product photography ad layout' },
  { id: 'comp-rule-r',     label: 'Rule of Thirds Right', category: 'composition',
    promptTemplate: '@img1 product, positioned right third of frame, large negative space on left for text overlay, product photography ad layout' },
  { id: 'comp-rule-top',   label: 'Upper Third',          category: 'composition',
    promptTemplate: '@img1 product, positioned in upper third of frame, negative space below for copy, product photography ad layout' },
  { id: 'comp-rule-bot',   label: 'Lower Third',          category: 'composition',
    promptTemplate: '@img1 product, positioned in lower third of frame, negative space above for headline, product photography ad layout' },
  { id: 'comp-diagonal',   label: 'Dynamic Diagonal',     category: 'composition',
    promptTemplate: '@img1 product, placed on dynamic diagonal angle 30 degrees, tilted energetic composition, modern product photography' },
  { id: 'comp-golden',     label: 'Golden Ratio',         category: 'composition',
    promptTemplate: '@img1 product, composed using golden ratio spiral placement, harmonious balanced framing, product photography' },
  { id: 'comp-frame',      label: 'Frame in Frame',       category: 'composition',
    promptTemplate: '@img1 product, framed within an archway window or geometric frame shape, frame within frame composition, product photography' },
  { id: 'comp-leading',    label: 'Leading Lines',        category: 'composition',
    promptTemplate: '@img1 product, with leading lines in background converging toward product, draws eye, architectural product photography' },
  { id: 'comp-symmetry',   label: 'Perfect Symmetry',     category: 'composition',
    promptTemplate: '@img1 product, perfectly symmetrical composition with mirrored elements on both sides, balanced, product photography' },
  { id: 'comp-negative',   label: 'Extreme Neg Space',    category: 'composition',
    promptTemplate: '@img1 product, tiny product in vast empty space, extreme negative space, minimalist editorial, product photography' },
  { id: 'comp-overlap',    label: 'Overlapping Elements',  category: 'composition',
    promptTemplate: '@img1 product, partially overlapping with complementary objects, layered depth composition, styled product photography' },
  { id: 'comp-bird',       label: 'Birds Eye Flat Lay',   category: 'composition',
    promptTemplate: '@img1 product, centered in perfectly arranged flat lay grid of items, birds eye view, organized aesthetic, product photography' },
  { id: 'comp-peek',       label: 'Peek / Partial Hide',  category: 'composition',
    promptTemplate: '@img1 product, partially hidden behind surface or object, peeking out, mystery and intrigue, creative product photography' },
];

/** Build a generation-ready prompt from a shot template.
 *  Appends lighting consistency clause to non-lighting shots
 *  so the product looks the same across all angles. */
export function buildAnglePrompt(shot: AngleShot, brandContext?: string): string {
  let prompt = shot.promptTemplate;
  // Keep lighting consistent with source image for non-lighting categories
  if (shot.category !== 'lighting') {
    prompt += ', maintain same lighting color temperature and exposure as reference image';
  }
  if (brandContext) {
    prompt += `, ${brandContext}`;
  }
  return prompt;
}

/** Get shots filtered by category */
export function getShotsByCategory(category: AngleShot['category']): AngleShot[] {
  return ANGLE_SHOTS.filter(s => s.category === category);
}
