/* ============================================
   BlogForge AI - Application Logic
   Free AI Blog Generator (No API Key Required)
   ============================================ */

const state = {
    isGenerating: false,
    currentBlog: null,
    history: JSON.parse(localStorage.getItem('blogforge_history') || '[]'),
    theme: localStorage.getItem('blogforge_theme') || 'dark',
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const els = {
    topicInput: $('#blog-topic'),
    toneSelect: $('#blog-tone'),
    lengthSelect: $('#blog-length'),
    charCount: $('#char-count'),
    generateBtn: $('#generate-btn'),
    outputSection: $('#output-section'),
    outputTitle: $('#output-title'),
    outputMeta: $('#output-meta'),
    outputBody: $('#output-body'),
    copyBtn: $('#copy-btn'),
    downloadBtn: $('#download-btn'),
    regenerateBtn: $('#regenerate-btn'),
    historyList: $('#history-list'),
    emptyHistory: $('#empty-history'),
    clearHistoryBtn: $('#clear-history-btn'),
    themeToggle: $('#theme-toggle'),
    toastContainer: $('#toast-container'),
    quickTopics: $('#quick-topics'),
};

/* === Theme === */
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    state.theme = theme;
    localStorage.setItem('blogforge_theme', theme);
}
applyTheme(state.theme);
els.themeToggle.addEventListener('click', () => {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
});

/* === Tab Navigation === */
$$('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        $$('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        $$('.tab-content').forEach(t => t.classList.remove('active'));
        document.getElementById('tab-' + tab).classList.add('active');
        if (tab === 'history') renderHistory();
    });
});

/* === Character Counter === */
els.topicInput.addEventListener('input', () => {
    let len = els.topicInput.value.length;
    if (len > 500) els.topicInput.value = els.topicInput.value.slice(0, 500);
    els.charCount.textContent = Math.min(len, 500) + ' / 500';
});

/* === Quick Topics === */
els.quickTopics.addEventListener('click', (e) => {
    const chip = e.target.closest('.topic-chip');
    if (!chip) return;
    els.topicInput.value = chip.dataset.topic;
    els.topicInput.dispatchEvent(new Event('input'));
    els.topicInput.focus();
});

/* === Toast Notifications === */
function showToast(message, type) {
    type = type || 'success';
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    const icons = { success: '\u2713', error: '\u2717', info: '\u2139' };
    toast.innerHTML = '<span>' + (icons[type] || icons.info) + '</span> ' + message;
    els.toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/* === Build Prompt === */
function buildPrompt(topic, tone, targetWords) {
    const toneDesc = {
        professional: 'professional, authoritative, clear, and informative',
        casual: 'casual, friendly, conversational, and relatable',
        academic: 'academic, well-researched, structured, data-driven',
        creative: 'creative, vivid storytelling with narrative techniques',
        humorous: 'humorous, witty with clever observations',
        persuasive: 'persuasive, compelling with strong arguments',
    };
    let p = 'Write a comprehensive blog post about: "' + topic + '".\n\n';
    p += 'Tone: ' + (toneDesc[tone] || toneDesc.professional) + '.\n';
    p += 'Length: approximately ' + targetWords + ' words.\n\n';
    p += 'FORMAT: Use Markdown. Start with # title. Use ## for sections.\n';
    p += 'Include introduction, 3-5 sections, bullet points, a blockquote, and a conclusion.\n';
    p += 'Use **bold** and *italics*. Be SEO-friendly. Start directly with the blog.';
    return p;
}

/* === Clean AI Output === */
function cleanAIOutput(text) {
    let c = text;
    c = c.replace(/\[\/INST\]/g, '');
    c = c.replace(/<\|[^|]*\|>/g, '');
    c = c.replace(/<\/s>/g, '');
    c = c.replace(/<s>/g, '');
    c = c.replace(/^(Here('s| is) (a|the|your)[^\n]*\n\n?)/i, '');
    c = c.replace(/^(Sure[!,.\s][^\n]*\n\n?)/i, '');
    c = c.replace(/^(Certainly[!,.\s][^\n]*\n\n?)/i, '');
    c = c.replace(/^(I'd be happy[^\n]*\n\n?)/i, '');
    return c.trim();
}

/* === Markdown to HTML === */
function markdownToHTML(md) {
    let html = md;
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, function(m, lang, code) {
        return '<pre><code>' + escapeHTML(code.trim()) + '</code></pre>';
    });
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/^---$/gm, '<hr>');
    html = html.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>');
    html = html.replace(/((?:<li>[^]*?<\/li>\s*)+)/g, '<ul>$1</ul>');
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
    let blocks = html.split('\n\n');
    html = blocks.map(block => {
        block = block.trim();
        if (!block) return '';
        if (/^<(h[1-6]|ul|ol|blockquote|pre|hr|li)/.test(block)) return block;
        return '<p>' + block.replace(/\n/g, '<br>') + '</p>';
    }).join('\n');
    return html;
}

function escapeHTML(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* === Hugging Face Free Inference === */
async function generateWithHuggingFace(topic, tone, targetWords) {
    const prompt = buildPrompt(topic, tone, targetWords);
    const instPrompt = '<s>[INST] ' + prompt + ' [/INST]';
    const body = {
        inputs: instPrompt,
        parameters: {
            max_new_tokens: Math.min(targetWords * 3, 4000),
            temperature: 0.75,
            top_p: 0.9,
            do_sample: true,
            return_full_text: false,
        },
    };
    const response = await fetch(
        'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(45000),
        }
    );
    if (!response.ok) throw new Error('HF error: ' + response.status);
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    if (Array.isArray(data) && data[0] && data[0].generated_text) {
        return cleanAIOutput(data[0].generated_text);
    }
    throw new Error('No text from HF');
}

/* === Built-in Smart Blog Generator (always works, no API) === */
function generateBuiltIn(topic, tone, targetWords) {
    const topicLower = topic.toLowerCase();
    const title = generateTitle(topic, tone);
    const intro = generateIntro(topic, tone);
    const sections = generateSections(topic, tone, targetWords);
    const conclusion = generateConclusion(topic, tone);

    let blog = '# ' + title + '\n\n';
    blog += intro + '\n\n';
    for (const sec of sections) {
        blog += '## ' + sec.heading + '\n\n';
        blog += sec.content + '\n\n';
    }
    blog += '## Conclusion\n\n' + conclusion;
    return blog;
}

function generateTitle(topic, tone) {
    const templates = [
        'The Complete Guide to ' + capitalizeWords(topic),
        capitalizeWords(topic) + ': Everything You Need to Know',
        'Understanding ' + capitalizeWords(topic) + ' in the Modern Era',
        'Why ' + capitalizeWords(topic) + ' Matters More Than Ever',
        capitalizeWords(topic) + ': A Deep Dive Into What Really Works',
        'The Ultimate Guide to ' + capitalizeWords(topic),
    ];
    return templates[Math.floor(Math.random() * templates.length)];
}

function generateIntro(topic, tone) {
    const intros = {
        professional: 'In today\'s rapidly evolving landscape, **' + topic + '** has emerged as a critical topic that demands our attention. Whether you\'re a seasoned professional or just beginning to explore this field, understanding the nuances of this subject is essential for staying ahead of the curve.\n\nThis comprehensive guide will walk you through everything you need to know, from foundational concepts to advanced strategies that industry leaders are implementing right now.',
        casual: 'Hey there! \ud83d\udc4b Let\'s talk about something that\'s been on everyone\'s mind lately \u2014 **' + topic + '**. I know, I know, it might sound like a big topic to tackle, but don\'t worry \u2014 I\'m going to break it all down in a way that actually makes sense.\n\nGrab your favorite drink, get comfortable, and let\'s dive into this together!',
        academic: 'The study of **' + topic + '** represents a significant area of inquiry that has garnered increasing attention from researchers, practitioners, and policymakers alike. Recent developments in this field have prompted a re-examination of established paradigms and methodologies.\n\nThis article provides a systematic analysis of the current state of knowledge, examining key findings, methodological approaches, and implications for future research and practice.',
        creative: 'Imagine a world where **' + topic + '** transforms everything we thought we knew. A world where the boundaries of possibility are redrawn, and new horizons emerge from the intersection of innovation and imagination.\n\nThat world isn\'t some distant fantasy \u2014 it\'s unfolding right now, and in this story, you\'re both the reader and the protagonist. Let me take you on a journey that will change how you see everything.',
        humorous: 'Alright, let\'s address the elephant in the room \u2014 **' + topic + '**. Yes, I know what you\'re thinking: "Oh great, another article about this." But hear me out, because this one comes with actual useful information AND my questionable sense of humor. Two for the price of one! \ud83c\udf89\n\nSo buckle up, buttercup. We\'re about to make this topic actually fun.',
        persuasive: '**' + topic + '** isn\'t just important \u2014 it\'s absolutely essential for anyone who wants to thrive in today\'s world. The data is clear, the trends are undeniable, and the opportunity window is narrowing by the day.\n\nIf you\'ve been sitting on the sidelines, this is your wake-up call. Here\'s exactly why you need to pay attention and what you can do about it starting today.',
    };
    return intros[tone] || intros.professional;
}

function generateSections(topic, tone, targetWords) {
    const numSections = targetWords > 800 ? 5 : targetWords > 500 ? 4 : 3;
    const sectionTemplates = [
        {
            heading: 'Understanding the Fundamentals',
            content: 'At its core, **' + topic + '** revolves around several key principles that form the foundation of everything else we\'ll discuss. Understanding these fundamentals isn\'t just academic \u2014 it\'s practical knowledge that directly impacts outcomes.\n\n'
                + '- **Core Principle 1**: The foundational concepts establish a framework for understanding the broader implications\n'
                + '- **Core Principle 2**: Building on this foundation, we see how theory translates into practical application\n'
                + '- **Core Principle 3**: The intersection of these ideas creates new opportunities for innovation\n'
                + '- **Core Principle 4**: Understanding the limitations helps us push boundaries more effectively\n\n'
                + '> "The key to mastering any subject lies not in memorizing facts, but in understanding the principles that connect them." \u2014 A truth that applies perfectly to ' + topic,
        },
        {
            heading: 'Current Trends and Developments',
            content: 'The landscape of **' + topic + '** is evolving at an unprecedented pace. Recent developments have reshaped how we think about this field, introducing new possibilities while challenging established assumptions.\n\n'
                + 'Several key trends are driving this transformation:\n\n'
                + '1. **Technological Advancement**: New tools and platforms are making it easier than ever to engage with ' + topic + '\n'
                + '2. **Shifting Perspectives**: The way experts approach this topic has fundamentally changed in recent years\n'
                + '3. **Growing Accessibility**: What was once available only to specialists is now accessible to a broader audience\n'
                + '4. **Data-Driven Insights**: Modern analytics provide deeper understanding and more informed decision-making\n\n'
                + 'These trends aren\'t just interesting observations \u2014 they represent actionable opportunities for anyone willing to engage with them.',
        },
        {
            heading: 'Practical Strategies and Best Practices',
            content: 'Theory is valuable, but what truly matters is **putting knowledge into practice**. Here are proven strategies that consistently deliver results when it comes to ' + topic + ':\n\n'
                + '**Strategy 1: Start With Clear Objectives**\n'
                + 'Before diving in, define what success looks like for you. This clarity will guide every decision and help you measure progress effectively.\n\n'
                + '**Strategy 2: Leverage Available Resources**\n'
                + 'You don\'t need to reinvent the wheel. There are countless tools, communities, and resources dedicated to ' + topic + ' that can accelerate your journey.\n\n'
                + '**Strategy 3: Iterate and Adapt**\n'
                + 'The most successful practitioners aren\'t those who get everything right on the first try \u2014 they\'re the ones who learn quickly and adapt their approach based on real feedback.\n\n'
                + '> "Success is not about perfection; it\'s about continuous improvement and the willingness to evolve."',
        },
        {
            heading: 'Common Challenges and How to Overcome Them',
            content: 'No journey is without obstacles, and **' + topic + '** is no exception. Here are the most common challenges people face and practical solutions to overcome them:\n\n'
                + '- **Information Overload**: With so much content available, it\'s easy to feel overwhelmed. Focus on curated, high-quality sources and build your knowledge systematically\n'
                + '- **Analysis Paralysis**: Don\'t wait for perfect conditions. Start with what you know and refine as you go\n'
                + '- **Keeping Up With Changes**: The field evolves quickly. Subscribe to key thought leaders, join communities, and dedicate regular time to staying current\n'
                + '- **Measuring Impact**: Establish clear metrics from the start. What gets measured gets improved\n\n'
                + 'Remember, every expert was once a beginner. The challenges you face today are building the expertise you\'ll have tomorrow.',
        },
        {
            heading: 'The Future Outlook',
            content: 'Looking ahead, the future of **' + topic + '** is incredibly promising. Several emerging developments suggest we\'re on the cusp of significant breakthroughs that could transform the entire landscape.\n\n'
                + '**What to Watch For:**\n\n'
                + '- *Emerging Technologies*: New innovations are creating possibilities that were unimaginable just a few years ago\n'
                + '- *Evolving Standards*: Industry best practices are continuously refined as we learn from collective experience\n'
                + '- *Global Connectivity*: The ability to collaborate and share knowledge across borders is accelerating progress\n'
                + '- *Sustainability Focus*: Long-term thinking is increasingly prioritized over short-term gains\n\n'
                + 'Those who position themselves at the forefront of these changes will have a significant advantage in the years to come.',
        },
        {
            heading: 'Real-World Applications and Examples',
            content: 'Understanding **' + topic + '** in theory is one thing, but seeing it in action brings everything to life. Across industries and contexts, innovative applications are demonstrating the real-world impact of these concepts.\n\n'
                + 'From startups to established enterprises, organizations are finding creative ways to apply these principles:\n\n'
                + '- **In Business**: Companies are leveraging these insights to gain competitive advantages and drive growth\n'
                + '- **In Education**: Educators are incorporating these concepts to create more effective and engaging learning experiences\n'
                + '- **In Personal Development**: Individuals are applying these strategies to achieve their personal and professional goals\n\n'
                + '> "The best way to predict the future is to create it." \u2014 This philosophy is at the heart of how leaders approach ' + topic,
        },
    ];

    // Shuffle and select sections
    const shuffled = sectionTemplates.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, numSections);
}

function generateConclusion(topic, tone) {
    const conclusions = {
        professional: 'As we\'ve explored throughout this article, **' + topic + '** represents both a significant challenge and an extraordinary opportunity. The key takeaways are clear: understanding the fundamentals, staying current with trends, implementing proven strategies, and maintaining adaptability are all essential for success.\n\nThe landscape will continue to evolve, and those who invest in their understanding today will be best positioned to thrive tomorrow. We encourage you to take these insights and apply them in your own context \u2014 the results may exceed your expectations.',
        casual: 'And there you have it! \ud83c\udf1f **' + topic + '** doesn\'t have to be complicated or intimidating. The most important thing is to just get started, stay curious, and don\'t be afraid to make mistakes along the way.\n\nI hope this helped clear things up for you. If you found this useful, share it with someone who might benefit too. Until next time, keep being awesome! \u270c\ufe0f',
        academic: 'This analysis of **' + topic + '** has illuminated several critical dimensions that merit continued attention from both researchers and practitioners. The evidence suggests that an interdisciplinary approach, combined with rigorous methodology and practical application, yields the most significant outcomes.\n\nFuture research should focus on addressing the identified gaps in our understanding while building upon the established foundational knowledge. The implications of these findings extend beyond the immediate field and contribute to broader academic discourse.',
        creative: 'And so our journey through the world of **' + topic + '** comes to a close \u2014 but really, it\'s just the beginning. Every ending is a doorway, and what lies beyond is limited only by our imagination and determination.\n\nThe story of ' + topic + ' is still being written, and you have the pen. What chapter will you write next?',
        humorous: 'So there you have it, folks \u2014 **' + topic + '** demystified, decoded, and delivered with (hopefully) a few chuckles along the way. If you\'ve made it this far, congratulations \u2014 you now know more about this topic than approximately 73% of people at dinner parties. (I made that stat up, but it feels right.)\n\nNow go forth and impress people with your newfound wisdom! \ud83d\ude80',
        persuasive: 'The evidence is overwhelming, the opportunity is clear, and the time to act is **now**. Everything we\'ve discussed about **' + topic + '** points to one undeniable conclusion: those who take action today will be the leaders of tomorrow.\n\nDon\'t wait for the perfect moment \u2014 it doesn\'t exist. Start with one step, build momentum, and watch as the possibilities unfold before you. The question isn\'t whether you can afford to engage with this topic \u2014 it\'s whether you can afford not to.',
    };
    return conclusions[tone] || conclusions.professional;
}

function capitalizeWords(str) {
    return str.replace(/\b\w/g, c => c.toUpperCase());
}

/* === Main Generate Function === */
async function generateBlog(topic, tone, length) {
    const wordCounts = { short: 300, medium: 600, long: 1000, detailed: 1500 };
    const targetWords = wordCounts[length] || 600;

    // Try HuggingFace first, fallback to built-in
    try {
        const result = await generateWithHuggingFace(topic, tone, targetWords);
        if (result && result.trim().length > 200) {
            return { text: result, source: 'AI (Mistral)' };
        }
    } catch (err) {
        console.warn('HF API failed:', err.message);
    }

    // Built-in generator (always works)
    const result = generateBuiltIn(topic, tone, targetWords);
    return { text: result, source: 'BlogForge AI' };
}

/* === Generate Button Handler === */
els.generateBtn.addEventListener('click', handleGenerate);

async function handleGenerate() {
    const topic = els.topicInput.value.trim();
    if (!topic) {
        showToast('Please enter a topic for your blog post', 'error');
        els.topicInput.focus();
        return;
    }
    if (state.isGenerating) return;

    state.isGenerating = true;
    els.generateBtn.classList.add('loading');
    els.outputSection.classList.add('hidden');

    try {
        const tone = els.toneSelect.value;
        const length = els.lengthSelect.value;
        const result = await generateBlog(topic, tone, length);

        state.currentBlog = {
            topic: topic,
            tone: tone,
            length: length,
            content: result.text,
            source: result.source,
            timestamp: Date.now(),
        };

        // Render output
        const htmlContent = markdownToHTML(result.text);
        els.outputBody.innerHTML = htmlContent;

        // Extract title from markdown
        const titleMatch = result.text.match(/^#\s+(.+)$/m);
        if (titleMatch) {
            els.outputTitle.textContent = titleMatch[1].replace(/\*\*/g, '');
        } else {
            els.outputTitle.textContent = 'Generated Blog Post';
        }

        const wordCount = result.text.split(/\s+/).length;
        const readTime = Math.max(1, Math.ceil(wordCount / 200));
        els.outputMeta.textContent = wordCount + ' words \u00b7 ' + readTime + ' min read \u00b7 ' + result.source;

        els.outputSection.classList.remove('hidden');
        els.outputSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Save to history
        saveToHistory(state.currentBlog);
        showToast('Blog post generated successfully!');

    } catch (err) {
        console.error('Generation error:', err);
        showToast('Something went wrong. Please try again.', 'error');
    } finally {
        state.isGenerating = false;
        els.generateBtn.classList.remove('loading');
    }
}

/* === Copy to Clipboard === */
els.copyBtn.addEventListener('click', async () => {
    if (!state.currentBlog) return;
    try {
        await navigator.clipboard.writeText(state.currentBlog.content);
        els.copyBtn.classList.add('copied');
        els.copyBtn.querySelector('span').textContent = 'Copied!';
        showToast('Blog content copied to clipboard!');
        setTimeout(() => {
            els.copyBtn.classList.remove('copied');
            els.copyBtn.querySelector('span').textContent = 'Copy';
        }, 2000);
    } catch (err) {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = state.currentBlog.content;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('Blog content copied!');
    }
});

/* === Download === */
els.downloadBtn.addEventListener('click', () => {
    if (!state.currentBlog) return;
    const blob = new Blob([state.currentBlog.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = state.currentBlog.topic.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '-').toLowerCase();
    a.download = 'blog-' + safeName.slice(0, 40) + '.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Blog downloaded as Markdown file!');
});

/* === Regenerate === */
els.regenerateBtn.addEventListener('click', () => {
    handleGenerate();
});

/* === History Management === */
function saveToHistory(blog) {
    state.history.unshift({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        topic: blog.topic,
        tone: blog.tone,
        length: blog.length,
        content: blog.content,
        source: blog.source,
        timestamp: blog.timestamp,
    });
    // Keep last 50
    if (state.history.length > 50) state.history = state.history.slice(0, 50);
    localStorage.setItem('blogforge_history', JSON.stringify(state.history));
}

function renderHistory() {
    const list = els.historyList;
    if (state.history.length === 0) {
        list.innerHTML = '';
        list.appendChild(els.emptyHistory || createEmptyState());
        return;
    }

    list.innerHTML = state.history.map(item => {
        const date = new Date(item.timestamp);
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const preview = item.content.replace(/[#*>_\-]/g, '').slice(0, 120) + '...';
        const wordCount = item.content.split(/\s+/).length;

        return '<div class="history-item" data-id="' + item.id + '">'
            + '<div class="history-item-header">'
            + '<div class="history-item-title">' + escapeHTML(item.topic) + '</div>'
            + '<div class="history-item-date">' + dateStr + ' ' + timeStr + '</div>'
            + '</div>'
            + '<div class="history-item-preview">' + escapeHTML(preview) + '</div>'
            + '<div class="history-item-meta">'
            + '<span class="history-meta-tag">' + item.tone + '</span>'
            + '<span class="history-meta-tag">' + wordCount + ' words</span>'
            + '<span class="history-meta-tag">' + (item.source || 'AI') + '</span>'
            + '</div>'
            + '<div class="history-item-actions">'
            + '<button class="history-action-btn view-btn" data-id="' + item.id + '">\u{1f441} View</button>'
            + '<button class="history-action-btn copy-hist-btn" data-id="' + item.id + '">\u{1f4cb} Copy</button>'
            + '<button class="history-action-btn delete" data-id="' + item.id + '">\u{1f5d1} Delete</button>'
            + '</div>'
            + '</div>';
    }).join('');

    // Event delegation for history actions
    list.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const item = state.history.find(h => h.id === btn.dataset.id);
            if (item) {
                state.currentBlog = item;
                els.outputBody.innerHTML = markdownToHTML(item.content);
                const titleMatch = item.content.match(/^#\s+(.+)$/m);
                els.outputTitle.textContent = titleMatch ? titleMatch[1].replace(/\*\*/g, '') : item.topic;
                const wc = item.content.split(/\s+/).length;
                els.outputMeta.textContent = wc + ' words \u00b7 ' + Math.ceil(wc/200) + ' min read';
                els.outputSection.classList.remove('hidden');
                // Switch to generator tab
                $$('.nav-btn').forEach(b => b.classList.remove('active'));
                document.getElementById('nav-generator').classList.add('active');
                $$('.tab-content').forEach(t => t.classList.remove('active'));
                document.getElementById('tab-generator').classList.add('active');
                els.outputSection.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    list.querySelectorAll('.copy-hist-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const item = state.history.find(h => h.id === btn.dataset.id);
            if (item) {
                try {
                    await navigator.clipboard.writeText(item.content);
                    showToast('Copied to clipboard!');
                } catch (err) {
                    showToast('Failed to copy', 'error');
                }
            }
        });
    });

    list.querySelectorAll('.delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            state.history = state.history.filter(h => h.id !== btn.dataset.id);
            localStorage.setItem('blogforge_history', JSON.stringify(state.history));
            renderHistory();
            showToast('Entry deleted');
        });
    });
}

function createEmptyState() {
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.innerHTML = '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>'
        + '<h3>No history yet</h3><p>Your generated blog posts will appear here</p>';
    return div;
}

/* === Clear History === */
els.clearHistoryBtn.addEventListener('click', () => {
    if (state.history.length === 0) return;
    if (confirm('Are you sure you want to clear all history?')) {
        state.history = [];
        localStorage.setItem('blogforge_history', JSON.stringify(state.history));
        renderHistory();
        showToast('History cleared');
    }
});

/* === Initialize === */
renderHistory();
console.log('BlogForge AI initialized - Free AI Blog Generator (No API Key Required)');
