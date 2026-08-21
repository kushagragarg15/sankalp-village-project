const dotenv = require('dotenv');
const connectDB = require('../config/db');
const Resource = require('../models/Resource');
const { processResourceContent } = require('../services/embeddingService');

// Load env vars
dotenv.config();

// Sample teaching resources covering different subjects and grades
const sampleResources = [
  {
    title: 'Class 3 Math - Addition and Subtraction with Everyday Objects',
    subject: 'Math',
    grade: 'Class 3',
    content: `This lesson introduces addition and subtraction using objects children encounter daily.

Learning Approach:
Start with concrete objects like stones, sticks, or seeds. Children should physically count and manipulate these objects before moving to abstract numbers.

Addition Activities:
- Collect 5 stones and 3 more stones. Count together: "1, 2, 3, 4, 5... now 6, 7, 8. We have 8 stones!"
- Use fingers as counting tools. Show different combinations that make the same sum (3+2 and 4+1 both equal 5)
- Practice with everyday scenarios: "If you have 4 rotis and get 3 more, how many do you have?"

Subtraction Activities:
- Start with 7 seeds, remove 3. Count what remains: "7 take away 3 leaves 4"
- Use the "crossing out" method on paper: draw 6 mangoes, cross out 2, count what's left
- Real-world problems: "You had 8 pencils, you gave 5 to friends, how many do you have left?"

Common Mistakes to Address:
- Students counting incorrectly when objects are spread out - teach them to line up objects
- Confusing addition and subtraction symbols - practice reading problems aloud
- Starting from 0 instead of 1 when counting

Assessment Ideas:
Create simple word problems using their environment: "There are 6 cows in the field, 2 more arrive, how many total?" Make it visual and concrete.`
  },
  {
    title: 'Class 4 Math - Introducing Fractions Using Rotis and Fruit',
    subject: 'Math',
    grade: 'Class 4',
    content: `Fractions can be abstract, but using familiar food items makes them concrete and relatable.

Core Concept:
A fraction represents parts of a whole. The bottom number (denominator) tells how many equal parts we divide something into. The top number (numerator) tells how many of those parts we're talking about.

Using Rotis:
- Show a whole roti. This is 1 whole, or 4/4 if we divide it into 4 pieces
- Fold the roti in half. Each half is 1/2. Two halves make one whole
- Fold into quarters. Each piece is 1/4. Four quarters make one whole
- If you eat one piece, you ate 1/4, and 3/4 remains

Using Fruits (Oranges work great):
- An orange can be divided into segments (usually 8-10)
- If an orange has 8 segments, each segment is 1/8
- If you eat 3 segments, you ate 3/8 of the orange
- If your friend eats 2 segments, they ate 2/8, and 3/8 remains

Comparing Fractions:
- Use two rotis of the same size. Cut one into halves (1/2 pieces), one into quarters (1/4 pieces)
- Show that 1/2 is bigger than 1/4 (when we divide into fewer pieces, each piece is larger)
- Practice: Which is more - 1/2 of a roti or 1/4 of a roti?

Activities:
- Draw circles representing rotis on paper. Have students shade in fractions (shade 1/2, shade 2/4, shade 3/4)
- Create fraction word problems: "You have 1 mango. You eat 1/4. How much is left?"
- Practice equivalent fractions: Show that 1/2 = 2/4 by folding paper

Important: Always use equal pieces. A common misconception is unequal pieces can still be fractions.`
  },
  {
    title: 'Class 5 Math - Basic Shapes and Geometry Around the House',
    subject: 'Math',
    grade: 'Class 5',
    content: `Geometry comes alive when students discover shapes in their everyday environment.

Basic Shapes to Identify:
1. Circle - perfectly round, like a wheel or a coin. Every point on the edge is the same distance from the center
2. Triangle - 3 sides, 3 corners (vertices). The angles inside always add up to 180 degrees
3. Square - 4 equal sides, 4 right angles (90-degree corners)
4. Rectangle - 4 sides, opposite sides equal, 4 right angles
5. Pentagon - 5 sides (like many house roofs from the front)
6. Hexagon - 6 sides (like honeycomb cells)

Shape Hunt Activity:
Take students on a walk and identify shapes:
- Windows: usually rectangles or squares
- Doors: rectangles
- Wheels: circles
- Roof sections: triangles
- Floor tiles: often squares or rectangles
- Coins: circles
- Books: rectangles

Understanding Properties:
For each shape found, discuss:
- How many sides? Count them together
- How many corners (vertices)? Point to each one
- Are all sides equal or different?
- What are the angles like? (right angles, acute, obtuse)

Hands-On Creation:
- Use sticks to build shapes (3 sticks make a triangle, 4 equal sticks make a square)
- Draw shapes with rulers and pencils
- Create patterns by repeating shapes
- Challenge: Can you make a big shape from smaller shapes? (Example: 4 triangles can make a square)

Measuring:
Introduce perimeter (distance around) and area (space inside):
- Perimeter of a square: add all 4 sides, or multiply one side by 4
- Area of a rectangle: length × width
- Use string to measure perimeter of real objects

Real-World Applications:
- How much fencing needed for a rectangular garden? (perimeter)
- How many tiles needed to cover a floor? (area)
- Which window has more glass, the square one or the rectangular one? (compare areas)`
  },
  {
    title: 'Class 3 English - Phonics and Sounding Out Words',
    subject: 'English',
    grade: 'Class 3',
    content: `Phonics helps children decode words by connecting letters to sounds.

Foundation: Letter Sounds
Every letter makes a sound. Students must first master individual letter sounds before blending them into words.

Short Vowel Sounds (critical for early reading):
- a as in "cat" - open mouth, short sound
- e as in "bed" - short, middle sound
- i as in "sit" - quick, pinched sound
- o as in "hot" - short, open sound
- u as in "cup" - short, middle sound

Consonants:
Start with simple, consistent consonants: b, c, d, f, g, h, j, k, l, m, n, p, r, s, t, v, w, y, z

Blending Sounds (the magic of reading):
Teach the technique: sound out each letter, then blend together quickly
Example with "cat":
- Point to 'c', say "kuh"
- Point to 'a', say "aaa"
- Point to 't', say "tuh"
- Blend: "kuh-aaa-tuh... cat!"

Practice Sequence:
1. Start with 3-letter CVC words (Consonant-Vowel-Consonant): cat, dog, sun, pig, mat, pen
2. Move to words with the same pattern: bat, rat, hat, sat (builds confidence)
3. Introduce new consonant blends: bl, br, cr, dr, fl, fr, gr, pl, pr, tr
4. Words like: brat, trip, flat, drop

Common Phonics Patterns:
- Silent 'e' changes the vowel sound: cap → cape, sit → site, hop → hope
- 'th' together makes a new sound (this, that, three)
- 'sh' makes "shhhh" sound (ship, fish, shop)
- 'ch' makes "chuh" sound (chip, chat, much)

Activities:
- Sound hopscotch: write letters on ground, hop and say the sound
- Word building: give letter cards, students build CVC words
- Picture-word matching: show a picture of a cat, students sound out and write "cat"
- Rhyming games: "What rhymes with cat? Bat! Mat! Hat!"

Tips for Teaching:
- Exaggerate sounds initially, then speak normally
- Use hand motions for sounds (helps memory)
- Practice daily for 10-15 minutes
- Celebrate every successful blend!`
  },
  {
    title: 'Class 5 English - Building Reading Comprehension with Short Stories',
    subject: 'English',
    grade: 'Class 5',
    content: `Reading comprehension is about understanding, not just pronouncing words. Here's how to build this critical skill.

Before Reading (Activate Background Knowledge):
- Show the title and any pictures. Ask: "What do you think this story is about?"
- Introduce 3-4 difficult words they'll encounter. Explain meanings and use in sentences
- Set a purpose: "As you read, think about why the character made this choice"

During Reading (Active Reading Strategies):
- Read Aloud First: Teacher reads the first paragraph with expression, students follow along
- Choral Reading: Class reads together (builds fluency and confidence)
- Partner Reading: Students take turns reading sentences to each other
- Stop and Predict: Pause at key moments, ask "What will happen next?"
- Visualize: "Close your eyes. What does the scene look like in your mind?"

After Reading (Deep Comprehension):
Ask questions at different levels:

Level 1 - Literal (right there in the text):
- Who are the main characters?
- Where does the story take place?
- What happened first? Next? Last?

Level 2 - Inferential (reading between the lines):
- How do you think the character felt when...?
- Why did the character do that?
- What caused this to happen?

Level 3 - Critical (connecting to life):
- Have you ever felt like this character?
- What would you do differently?
- What is the lesson or message of the story?

Specific Strategies to Teach:

1. Main Idea vs Details:
"The main idea is what the whole paragraph or story is mostly about. Details are the smaller facts that support it."
Practice: Read a paragraph, ask "What is this mostly about?" Then: "What details tell us that?"

2. Making Inferences:
"Authors don't always tell us everything directly. We use clues in the text plus what we already know."
Example: "Priya shivered and pulled her sweater tight." → We infer: It's cold.

3. Sequence of Events:
Use words like first, next, then, after, finally to understand order.
Activity: After reading, students draw 4 pictures showing beginning, middle, middle, end.

4. Character Analysis:
"What is this character like? How do you know?"
Make a T-chart: On one side, list character traits (brave, kind, foolish). On other side, list evidence from text.

Activities for Practice:
- Story retelling: Students retell story in their own words
- Acting it out: Assign roles, act out the story (makes it memorable)
- Question generation: Students write their own questions about the story
- Connecting stories: "This character reminds me of..." or "This is like when I..."

Choosing Good Stories:
- Start with stories about familiar experiences (family, school, village life)
- Include folktales and moral stories (culturally relevant)
- Gradually increase length and complexity
- Use stories with clear plots and relatable characters`
  },
  {
    title: 'Class 4 Science - The Water Cycle Explained Simply',
    subject: 'Science',
    grade: 'Class 4',
    content: `The water cycle is the continuous journey water takes as it moves around Earth.

The Four Main Stages:

1. Evaporation (Water → Water Vapor)
When the sun heats water in oceans, rivers, lakes, and even puddles, some water turns into an invisible gas called water vapor. This vapor rises up into the air.

Simple Explanation: "When clothes dry on the line, where does the water go? It evaporates into the air!"

Demonstration: On a sunny day, put water in a shallow plate outside. Mark the water level. Check after a few hours - the water level drops because water evaporated.

2. Condensation (Water Vapor → Clouds)
As water vapor rises high in the sky, it gets cold. The cold makes the water vapor turn back into tiny water droplets. Millions of these tiny droplets stick together to form clouds.

Simple Explanation: "Clouds are made of tiny water droplets floating in the sky, like fog."

Demonstration: Breathe on a mirror. You see fog/condensation - your warm breath (water vapor) hits the cold mirror and turns back into water droplets.

3. Precipitation (Clouds → Rain/Snow)
When clouds get full of water droplets, the droplets join together to make bigger drops. These drops get heavy and fall as rain. If it's very cold, they fall as snow or hail.

Simple Explanation: "When clouds can't hold any more water, it rains!"

4. Collection (Water Gathers)
Rain and snow fall to the ground. Some water flows into rivers and streams that lead to oceans and lakes. Some water soaks into the ground. Then the sun heats this water again, and the cycle repeats!

Key Concepts Students Must Understand:
- The same water keeps cycling over and over. The water you drink today might have been in a cloud yesterday!
- The sun is the "engine" that powers the water cycle by heating water
- Water changes form (liquid → vapor → liquid) but it's still water
- No water is created or destroyed, it just moves around

Hands-On Activity - Mini Water Cycle:
Materials: Clear plastic bowl, smaller cup, plastic wrap, small stone, water, sunny spot

Steps:
1. Pour water into the bowl (about 2cm deep)
2. Place empty cup in the center of the bowl
3. Cover bowl tightly with plastic wrap
4. Put small stone on top of plastic wrap, right above the cup (makes a low point)
5. Place in sunny spot for several hours

What Happens:
- Sun heats water (evaporation)
- Water vapor rises and hits plastic wrap
- Cool plastic causes condensation (water droplets form)
- Droplets slide down to the low point (where the stone is)
- Droplets drip into the cup (precipitation and collection)

Discussion Questions:
- Where does rain come from? (from clouds, which form from evaporated water)
- Why do we have rivers and oceans? (water collects there after rain)
- Why don't we run out of water? (because of the cycle - water is reused)
- Why do puddles disappear after rain? (water evaporates)

Real-Life Connections:
- Dew on grass in the morning (condensation from cool night air)
- Steam from hot food (evaporation)
- Fog (clouds touching the ground)
- Why it rains more in some places (near oceans and mountains)

Common Misconceptions to Correct:
- Clouds are not made of air or smoke - they're made of water droplets
- Evaporated water doesn't disappear, it just becomes invisible vapor
- Rain doesn't come from holes in clouds - clouds are made of water`
  },
  {
    title: 'Class 5 Science - Plants and Photosynthesis Basics',
    subject: 'Science',
    grade: 'Class 5',
    content: `Plants are like factories that make their own food. This process is called photosynthesis.

What is Photosynthesis?
Photosynthesis is how plants make food (sugar) using sunlight, water, and air. The word "photo" means light and "synthesis" means putting together.

The Simple Equation:
Sunlight + Water + Carbon Dioxide → Sugar (food) + Oxygen

What Plants Need:

1. Sunlight (Energy Source)
Plants need sunlight to power the food-making process. This is why plants grow toward light and why indoor plants need to be near windows.

Observation: Notice how plants in shade are often less healthy or grow bent toward the light.

2. Water (From the Soil)
Roots absorb water from the soil. This water travels up the stem to the leaves where photosynthesis happens.

Demonstration: Put a celery stalk in colored water. After a few hours, you can see the colored water has traveled up through the stem to the leaves!

3. Carbon Dioxide (From the Air)
Plants "breathe in" carbon dioxide through tiny holes in their leaves called stomata. We breathe out carbon dioxide, so we give plants what they need!

Important Connection: Plants give us oxygen (which we need to breathe), and we give plants carbon dioxide (which they need). We help each other!

4. Chlorophyll (The Green Molecule)
Chlorophyll is what makes leaves green. It's the special molecule that captures sunlight energy. Think of chlorophyll as the plant's solar panels.

This is why most leaves are green! (Some plants have red or purple pigments too, but they still have chlorophyll underneath.)

Where Does Photosynthesis Happen?
Mainly in the leaves. Leaves are thin and flat to capture as much sunlight as possible. If you look at a leaf closely, you'll see tiny lines called veins - these carry water to all parts of the leaf and carry the food (sugar) away.

What Plants Do With the Food:
- Use some immediately for energy (to grow, make flowers, etc.)
- Store some for later (in roots, fruits, or seeds)
- When we eat plants, we're eating the food the plant made through photosynthesis!

Understanding Oxygen Release:
The oxygen plants release is a "waste product" of photosynthesis. But it's not waste to us - we need this oxygen to breathe! This is why forests are called the "lungs of the Earth."

Experiments Students Can Do:

1. Testing for Starch (proves photosynthesis occurred):
- Cover part of a leaf with black paper for 2 days
- Remove paper
- The covered part will be lighter because it couldn't photosynthesize without light

2. Observing Oxygen Production:
- Put a water plant (like elodea) in water in a sunny spot
- Watch for bubbles rising from the leaves (this is oxygen being released)
- Move plant to darkness - bubbles stop (no light, no photosynthesis)

3. Plants Need Light:
- Grow two similar plants
- Put one in bright light, one in a dark closet
- After a week, the dark plant will be pale, weak, or dying

Parts of a Plant and Their Roles in Photosynthesis:

Roots: Absorb water and minerals from soil
Stem: Transports water up and food (sugar) down
Leaves: Main site of photosynthesis, contain chlorophyll, have stomata for gas exchange
Flowers/Fruits: Use the food made by photosynthesis to develop seeds

Discussion Questions:
- Why do plants die without sunlight?
- Why do plants die without water?
- Why are leaves usually green?
- How do plants help humans and animals?
- What would happen if there were no plants on Earth?

Real-World Applications:
- Why farmers clear weeds (weeds compete for sunlight and water)
- Why people keep houseplants (they freshen the air by producing oxygen)
- Why deforestation is harmful (fewer trees means less oxygen production and more carbon dioxide in air)
- Why plants grow better in greenhouses (controlled light and temperature)

Simple Analogy:
"Plants are like solar-powered chefs. They use sunlight as energy to cook food (sugar) from water and air. The delicious smell coming from the kitchen is like the oxygen plants release - a good by-product of cooking!"`
  },
  {
    title: 'General Teaching Tips - Running a Mixed-Age, One-Room Classroom with Limited Materials',
    subject: 'General',
    grade: 'All',
    content: `Teaching multiple grade levels simultaneously in a resource-limited setting requires special strategies.

Classroom Setup and Organization:

Group Seating Arrangement:
- Seat students in small groups (4-6 students) by age/grade level
- Use mats, benches, or floor seating if chairs are limited
- Create clear visual boundaries between grade groups (using chalk lines, rope, or existing furniture)
- Keep younger students closer to you for easier monitoring

Limited Materials Strategy:
- Shared resources: Have students pass materials (pencils, erasers, notebooks) within groups
- Take turns: Not everyone needs to write simultaneously - some can think/discuss while others write
- Reusable materials: Small chalkboards/slates or sand trays for practice before using precious paper
- Found materials: Collect sticks, stones, seeds, leaves for math and science lessons

Multi-Grade Teaching Techniques:

1. The Anchor Activity Method:
- Start class with all students together (10 min): Sing a song, review yesterday, discuss a shared topic
- Direct instruction to one grade level (15 min) while others do independent work
- Rotate your focus: Class 3 gets direct teaching, Class 4-5 work independently, then switch
- End together (5-10 min): Each group shares one thing they learned

2. Peer Teaching:
- Pair older students with younger ones for reading practice
- Have Class 5 students help Class 3 students with basic skills
- Benefits both: younger ones get help, older ones reinforce their knowledge by teaching

3. Tiered Activities (Same Lesson, Different Levels):
Example - Teaching about plants:
- Class 3: Identify and draw different plants, label parts (root, stem, leaf)
- Class 4: Same + explain what each part does
- Class 5: Same + explain photosynthesis and conduct an experiment

All students work on "plants," but at their appropriate level.

4. Learning Stations:
If space allows, set up 3-4 learning areas:
- Reading corner: Books and picture cards, older students read to younger
- Writing station: Different prompts for different levels
- Math manipulatives: Objects for counting, sorting, or measuring
- Art/science area: Drawing, building, or observing

Students rotate through stations while you provide direct help at one station.

Classroom Management With Mixed Ages:

Clear Routines:
Establish and practice routines until they're automatic:
- How to enter the classroom
- How to get materials
- Signal for attention (clap pattern, bell, raised hand)
- How to transition between activities
- How to ask for help (raise hand, write name on board)

Student Leaders:
Assign daily or weekly roles:
- Materials monitor: Distributes and collects supplies
- Attendance helper: Takes roll
- Time keeper: Reminds class of transitions
- Homework collector
- Board cleaner

This teaches responsibility and frees you to focus on teaching.

Attention Signals:
When you need everyone's attention:
- Call and response: You say "Class, class!" Students respond "Yes, yes!" and look at you
- Counting down: "5, 4, 3, 2, 1, eyes on me"
- Clapping pattern: You clap a rhythm, students clap it back and go silent
- Raised hand: When you raise your hand, students raise theirs and go quiet

Dealing With Limited Time:

Prioritize Core Skills:
- Focus on literacy (reading, writing) and numeracy (math) every single day
- These are foundational - everything else builds on them
- Spend at least 60-70% of time on these subjects

Combined Subjects When Possible:
- Reading comprehension passage about science topic (covers both English and Science)
- Math word problems using social studies contexts
- Writing assignments about science observations

No-Prep, High-Impact Activities:

For Early Finishers:
- "Teach someone else what you just learned"
- Read independently or to a younger student
- Create quiz questions for the class
- Draw and label a picture about today's lesson
- Practice handwriting or math facts

Quick Transitions (No Wasted Time):
- Have songs, clapping games, or movement activities ready for 2-minute transitions
- Use these to reset attention and energy
- Example: "Touch your toes, touch your head, sit back down on your mat instead!"

When Students are Stuck:
- Ask a neighbor first (encourages peer help)
- Try solving a simpler version of the problem
- Draw a picture of the problem
- "Put a checkmark and come back to it later"

Assessment Without Formal Tests:

Observation:
Watch students as they work. Notice:
- Who understands quickly?
- Who struggles with what?
- Who can explain to others?

Exit Tickets:
Last 5 minutes of class, each student tells or shows you one thing they learned. Quick, informal, tells you what stuck.

Group Sharing:
Have each group present their work. You learn what they understood and what needs reteaching.

Homework (When Appropriate):
- Keep it simple: practice today's skill
- Don't assign anything that requires parental help (many parents work or aren't literate)
- Make it doable in 15-20 minutes
- Review homework as a class the next day (so students get feedback)

Building Community and Motivation:

Celebrate Success:
- Praise specific actions: "I noticed you helped your classmate"
- Display student work
- Share progress with parents when possible
- Create a "Star of the Week" recognition

Make Learning Relevant:
Connect lessons to their lives:
- Use local examples and contexts
- Invite students to share their experiences
- Show how education helps solve real problems
- Bring in community members to talk about how they use literacy/numeracy

Create a Positive Environment:
- Greet students by name as they arrive
- Show genuine interest in their lives
- Use humor and joy - learning should be enjoyable!
- Be patient - students come from diverse backgrounds with different prior knowledge
- Maintain high expectations while providing support

Self-Care for Teachers:

- Prepare lessons in advance when possible (even just main ideas jotted down)
- Don't aim for perfection - aim for progress
- Connect with other teachers to share ideas and frustrations
- Celebrate your wins, even small ones
- Remember: You're making a profound difference in these children's lives

Remember: The best teaching often happens in imperfect circumstances with passionate, creative teachers who care about their students. You don't need fancy materials to change lives - you need patience, creativity, and commitment.`
  }
];

async function seedResources() {
  try {
    console.log('Connecting to database...');
    await connectDB();

    console.log('Clearing existing resources...');
    await Resource.deleteMany({});

    console.log('\nProcessing and embedding resources (this may take a minute)...\n');

    for (const resourceData of sampleResources) {
      console.log(`Processing: ${resourceData.title}`);
      
      // Process content: chunk and embed
      const chunks = await processResourceContent(resourceData.content);
      
      console.log(`  ✓ Created ${chunks.length} chunks with embeddings`);

      // Create resource with embedded chunks
      await Resource.create({
        ...resourceData,
        chunks
      });
    }

    console.log('\n✅ Successfully seeded resources!');
    console.log(`Total resources: ${sampleResources.length}`);
    console.log('\nResources by subject:');
    console.log('  - Math: 3 resources (Classes 3, 4, 5)');
    console.log('  - English: 2 resources (Classes 3, 5)');
    console.log('  - Science: 2 resources (Classes 4, 5)');
    console.log('  - General Teaching: 1 resource (All classes)');
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding resources:', error);
    process.exit(1);
  }
}

// Run the seeding
seedResources();
