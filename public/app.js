/**
 * Smart Counselling Website — Frontend Application Logic
 * Clean Vanilla JavaScript with strict accessibility and validation.
 */

document.addEventListener('DOMContentLoaded', () => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  // Update footer year dynamically
  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const API_BASE = (window.location.port && window.location.port !== '3000' && (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'))
    ? 'http://localhost:3000'
    : '';

  // ----------------------------------------------------
  // 1. Mobile Navigation
  // ----------------------------------------------------
  const mobileToggle = $('#mobile-toggle');
  const primaryNav = $('#primary-nav');

  if (mobileToggle && primaryNav) {
    const toggleNav = (isOpen) => {
      const state = typeof isOpen === 'boolean' ? isOpen : mobileToggle.getAttribute('aria-expanded') !== 'true';
      mobileToggle.setAttribute('aria-expanded', String(state));
      primaryNav.classList.toggle('nav-open', state);
      document.body.classList.toggle('menu-open', state);
    };

    mobileToggle.addEventListener('click', () => toggleNav());

    // Close menu when clicking any nav link
    $$('.nav-link, .button-nav', primaryNav).forEach(link => {
      link.addEventListener('click', () => toggleNav(false));
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && primaryNav.classList.contains('nav-open')) {
        toggleNav(false);
        mobileToggle.focus();
      }
    });
  }

  // ----------------------------------------------------
  // 2. Study Destination Pre-selection
  // ----------------------------------------------------
  $$('.destination-card').forEach(card => {
    const selectDestination = () => {
      const destValue = card.dataset.destination;
      const destSelect = $('#destination');
      if (destSelect && destValue) {
        destSelect.value = destValue;
        // Trigger change event to clear errors if any
        destSelect.dispatchEvent(new Event('change'));
      }
      const enquirySection = $('#enquiry');
      if (enquirySection) {
        enquirySection.scrollIntoView({ behavior: 'smooth' });
        // Focus either destination or name field
        const nameField = $('#name');
        if (nameField) setTimeout(() => nameField.focus(), 500);
      }
    };

    card.addEventListener('click', selectDestination);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectDestination();
      }
    });
  });

  // ----------------------------------------------------
  // 3. Approved FAQ Knowledge Base & Assistant
  // ----------------------------------------------------
  const APPROVED_FAQS = [
    {
      keywords: ['service', 'offer', 'help', 'what do you do', 'guidance', 'consultancy'],
      category: 'Services',
      answer: 'This demo presents four core guidance services: (1) Course and Destination Discovery, (2) Application Preparation Guidance, (3) Academic Document Checklists, and (4) Counselling Appointment Requests. In a live consultancy, actual services, fees, and agreements are confirmed directly by staff before proceeding.'
    },
    {
      keywords: ['fee', 'fees', 'cost', 'costs', 'price', 'pricing', 'charge', 'charges', 'free', 'payment'],
      category: 'Fees',
      answer: 'Official Demo Guidance: Specific service fees have not been established for this fictional demonstration website. We never invent arbitrary pricing. Please consult authorised consultancy staff for a complete, written breakdown of any applicable consultation or processing fees.'
    },
    {
      keywords: ['document', 'documents', 'paper', 'papers', 'transcript', 'transcripts', 'certificate', 'checklist', 'sop', 'lor', 'ielts', 'toefl'],
      category: 'Documents',
      answer: 'Common academic documents typically requested by international institutions include: official academic transcripts, degree certificates, a Statement of Purpose (SOP), letters of recommendation (LOR), and English proficiency test scores (such as IELTS or TOEFL). Specific requirements vary by university. Please note: Never upload or share sensitive documents or banking details in this demo.'
    },
    {
      keywords: ['appointment', 'book', 'schedule', 'call', 'meeting', 'counsellor', 'consultation'],
      category: 'Appointments',
      answer: 'You can request an appointment directly through our Enquiry Form below. Once your study interests and contact preferences are recorded, staff can reach out to confirm a suitable date and time for a detailed consultation.'
    },
    {
      keywords: ['destination', 'destinations', 'country', 'countries', 'uk', 'usa', 'canada', 'australia', 'europe'],
      category: 'Destinations',
      answer: 'The demonstration covers six destination pathways: United Kingdom, United States, Canada, Australia, Europe, and “Not sure yet”. Selecting a destination allows you to explore typical timelines and entry requirements, but does not guarantee institutional eligibility.'
    },
    {
      keywords: ['visa', 'visas', 'scholarship', 'scholarships', 'admission', 'admissions', 'guarantee', 'acceptance', 'eligible', 'eligibility', 'pr'],
      category: 'Admissions & Visas',
      answer: 'Important Notice: We do not and cannot guarantee university admission, scholarship awards, or visa approvals. Final admissions and visa decisions rest exclusively with the respective educational institutions and immigration authorities. Please speak with qualified staff for realistic, case-specific criteria.'
    },
    {
      keywords: ['whatsapp', 'contact', 'phone', 'reach', 'email'],
      category: 'Contact',
      answer: 'After submitting the enquiry form, a direct WhatsApp follow-up link is provided when configured with an authorised phone number by the site owner. You can also review recorded enquiries inside the secure Owner Dashboard.'
    }
  ];

  const getFaqResponse = (userInput) => {
    const query = userInput.toLowerCase().trim();
    if (!query) return '';

    // Check for matching FAQ rule
    const match = APPROVED_FAQS.find(faq =>
      faq.keywords.some(kw => query.includes(kw))
    );

    if (match) {
      return match.answer;
    }

    // Default honest fallback for unknown questions outside approved knowledge base
    return 'I cannot answer this from our approved demonstration guidelines, and I will not guess. Please use the Enquiry Form below or speak directly with our consultancy staff so they can provide accurate, up-to-date guidance for your specific situation.';
  };

  const chatLog = $('#chat-log');
  const chatForm = $('#chat-form');
  const chatInput = $('#chat-question');

  const appendChatMessage = (text, sender) => {
    if (!chatLog) return;
    const msg = document.createElement('div');
    msg.className = `chat-message ${sender}`;

    const label = document.createElement('span');
    label.className = 'message-label';
    label.textContent = sender === 'bot' ? 'ASSISTANT' : 'YOU';

    msg.appendChild(label);
    // Treat user text strictly as a text node to prevent any HTML injection / XSS
    msg.appendChild(document.createTextNode(text));

    chatLog.appendChild(msg);
    chatLog.scrollTop = chatLog.scrollHeight;
  };

  const submitQuestion = (questionText) => {
    const cleaned = (questionText || '').trim().slice(0, 300);
    if (!cleaned) return;

    appendChatMessage(cleaned, 'user');
    const answer = getFaqResponse(cleaned);
    appendChatMessage(answer, 'bot');
  };

  if (chatForm && chatInput) {
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      submitQuestion(chatInput.value);
      chatInput.value = '';
      chatInput.focus();
    });
  }

  // Handle suggested question chip buttons
  $$('.chip-button').forEach(button => {
    button.addEventListener('click', () => {
      const q = button.dataset.question;
      if (q) submitQuestion(q);
    });
  });

  // ----------------------------------------------------
  // 4. Smart Enquiry Form (Client Validation & Backend Sync)
  // ----------------------------------------------------
  const form = $('#enquiry-form');
  const submitButton = $('#submit-enquiry');
  const successPanel = $('#enquiry-success');
  const formStatus = $('#form-status');
  const whatsappLink = $('#whatsapp-link');
  const whatsappNote = $('#whatsapp-note');
  const newEnquiryBtn = $('#new-enquiry');

  const trackedFields = ['name', 'phone', 'email', 'destination', 'studyLevel'];

  const errorMessages = {
    name: 'Please enter your full name (at least 2 characters).',
    phone: 'Please enter a valid phone number with 10–15 digits.',
    email: 'Please enter a valid email address or leave it blank.',
    destination: 'Please select your preferred study destination.',
    studyLevel: 'Please select your intended course level.',
    consent: 'Consent is required before submitting your enquiry.'
  };

  const setFieldError = (fieldName, message) => {
    const field = $('#' + fieldName);
    const errorEl = $('#' + fieldName + '-error');
    if (field) {
      field.classList.toggle('invalid', Boolean(message));
      if (message) {
        field.setAttribute('aria-invalid', 'true');
      } else {
        field.removeAttribute('aria-invalid');
      }
    }
    if (errorEl) {
      errorEl.textContent = message || '';
    }
  };

  const validateForm = () => {
    let isValid = true;
    const nameVal = ($('#name')?.value || '').trim();
    const phoneVal = ($('#phone')?.value || '').trim().replace(/[\s()-]/g, '');
    const emailVal = ($('#email')?.value || '').trim();
    const destVal = $('#destination')?.value || '';
    const levelVal = $('#studyLevel')?.value || '';
    const consentChecked = $('#consent')?.checked;

    const validations = {
      name: nameVal.length >= 2,
      phone: /^\+?[0-9]{10,15}$/.test(phoneVal),
      email: !emailVal || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal),
      destination: ['UK', 'USA', 'Canada', 'Australia', 'Europe', 'Not sure yet'].includes(destVal),
      studyLevel: ['Undergraduate', 'Postgraduate', 'Diploma', 'Language course', 'Not sure yet'].includes(levelVal)
    };

    trackedFields.forEach(field => {
      if (!validations[field]) {
        setFieldError(field, errorMessages[field]);
        isValid = false;
      } else {
        setFieldError(field, '');
      }
    });

    if (!consentChecked) {
      setFieldError('consent', errorMessages.consent);
      isValid = false;
    } else {
      setFieldError('consent', '');
    }

    return isValid;
  };

  // Clear errors on user input
  trackedFields.forEach(fieldName => {
    const el = $('#' + fieldName);
    if (el) {
      el.addEventListener('input', () => setFieldError(fieldName, ''));
      el.addEventListener('change', () => setFieldError(fieldName, ''));
    }
  });

  const consentBox = $('#consent');
  if (consentBox) {
    consentBox.addEventListener('change', () => {
      setFieldError('consent', consentBox.checked ? '' : errorMessages.consent);
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!validateForm()) {
        const firstInvalid = $('.invalid', form) || (!consentBox?.checked ? consentBox : null);
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      // Prevent duplicate submissions and show loading state
      submitButton.disabled = true;
      const originalBtnContent = submitButton.innerHTML;
      submitButton.innerHTML = '<span>Saving Enquiry…</span> <span aria-hidden="true">⏳</span>';
      if (formStatus) formStatus.textContent = 'Submitting your enquiry, please wait…';

      const formData = new FormData(form);
      const payload = {
        name: formData.get('name') || '',
        phone: formData.get('phone') || '',
        email: formData.get('email') || '',
        destination: formData.get('destination') || '',
        studyLevel: formData.get('studyLevel') || '',
        message: formData.get('message') || '',
        website: formData.get('website') || '', // Honeypot
        consent: consentBox?.checked || false
      };

      try {
        const response = await fetch(`${API_BASE}/api/enquiries`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
          if (data.errors) {
            Object.entries(data.errors).forEach(([field, msg]) => setFieldError(field, msg));
            const first = $('.invalid', form);
            if (first) first.focus();
          } else {
            throw new Error(data.error || 'Server rejected the submission.');
          }
          if (formStatus) formStatus.textContent = 'Please correct the errors indicated above.';
          return;
        }

        // Successfully saved
        form.hidden = true;
        if (formStatus) formStatus.textContent = '';

        const successCopy = $('#success-copy');
        if (successCopy) {
          successCopy.textContent = `Your demonstration enquiry has been recorded with Reference #${data.id}. A staff member can review your enquiry in the owner dashboard.`;
        }

        // Check WhatsApp configuration via config API
        try {
          const cfgRes = await fetch(`${API_BASE}/api/config`);
          const config = await cfgRes.json();

          if (config.whatsappConfigured && config.whatsappNumber) {
            // Respect privacy: Only include non-sensitive metadata (Reference ID and destination)
            const waText = `Hello, I submitted an enquiry (Ref #${data.id}) on Smart Counselling Website regarding ${payload.destination} study options. I would like to speak with a counsellor.`;
            whatsappLink.href = `https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent(waText)}`;
            whatsappLink.hidden = false;
            if (whatsappNote) whatsappNote.hidden = true;
          } else {
            whatsappLink.hidden = true;
            if (whatsappNote) {
              whatsappNote.textContent = 'WhatsApp messaging option is currently unconfigured. The website owner can configure an authorised WhatsApp number in the server environment settings.';
              whatsappNote.hidden = false;
            }
          }
        } catch {
          whatsappLink.hidden = true;
        }

        successPanel.hidden = false;
        successPanel.focus();

      } catch (err) {
        if (formStatus) {
          formStatus.textContent = 'We could not save your enquiry right now. Please check your connection or contact staff.';
        }
      } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = originalBtnContent;
      }
    });
  }

  // Handle "Submit Another Enquiry" button
  if (newEnquiryBtn && form && successPanel) {
    newEnquiryBtn.addEventListener('click', () => {
      successPanel.hidden = true;
      form.hidden = false;
      form.reset();
      trackedFields.forEach(f => setFieldError(f, ''));
      setFieldError('consent', '');
      const nameInput = $('#name');
      if (nameInput) nameInput.focus();
    });
  }
});
