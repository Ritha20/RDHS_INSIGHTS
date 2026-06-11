// ─────────────────────────────────────────────────
// SHARED INDICATOR CATALOG & GEOGRAPHY CONSTANTS
// Included by both the Analyst Dashboard and the Report Builder workspace.
// Keep this file free of page-specific DOM logic — data + static config only.
// ─────────────────────────────────────────────────

const DISTRICT_PROVINCE = {
    'Nyarugenge': 1, 'Gasabo': 1, 'Kicukiro': 1,
    'Nyanza': 2, 'Gisagara': 2, 'Nyaruguru': 2, 'Huye': 2, 'Nyamagabe': 2,
    'Ruhango': 2, 'Muhanga': 2, 'Kamonyi': 2,
    'Karongi': 3, 'Rutsiro': 3, 'Rubavu': 3, 'Nyabihu': 3,
    'Ngororero': 3, 'Rusizi': 3, 'Nyamasheke': 3,
    'Rulindo': 4, 'Gakenke': 4, 'Musanze': 4, 'Burera': 4, 'Gicumbi': 4,
    'Rwamagana': 5, 'Nyagatare': 5, 'Gatsibo': 5, 'Kayonza': 5,
    'Kirehe': 5, 'Ngoma': 5, 'Bugesera': 5,
};

const PROVINCES = [
    { code: 1, name: 'Kigali City' },
    { code: 2, name: 'Southern Province' },
    { code: 3, name: 'Western Province' },
    { code: 4, name: 'Northern Province' },
    { code: 5, name: 'Eastern Province' }
];

const PROVINCE_NAMES = {
    1: 'Kigali City',
    2: 'Southern Province',
    3: 'Western Province',
    4: 'Northern Province',
    5: 'Eastern Province',
};

const NISR_SCALE = ['#C7D9F0', '#8FB8E0', '#5590C8', '#2D6AAE', '#1B3C74'];
const INDICATOR_COLORS = ['#1B3C74', '#0099D4', '#2D6AAE', '#00756A', '#E07B39', '#6B4E9B', '#C8563E', '#3D8C5A'];

const CHAPTERS = [
  {
    slug: 'household',
    title: 'Household Characteristics',
    emoji: '🏠',
    indicators: [
      { id: 'electricity', name: 'Electricity Access', path: '/chapter1/household-assets', fixedParams: { asset: 'electricity' }, description: 'Percentage of households with access to electricity.' },
      { id: 'mobile', name: 'Mobile Phone Ownership', path: '/chapter1/household-assets', fixedParams: { asset: 'mobile' }, description: 'Percentage of households owning a mobile phone.' },
      { id: 'radio', name: 'Radio Ownership', path: '/chapter1/household-assets', fixedParams: { asset: 'radio' }, description: 'Percentage of households owning a radio.' },
      { id: 'tv', name: 'Television Ownership', path: '/chapter1/household-assets', fixedParams: { asset: 'tv' }, description: 'Percentage of households owning a television.' },
      { id: 'computer', name: 'Computer Ownership', path: '/chapter1/household-assets', fixedParams: { asset: 'computer' }, description: 'Percentage of households owning a computer.' },
      { id: 'handwashing', name: 'Handwashing Facilities', path: '/chapter1/handwashing', fixedParams: {}, description: 'Percentage of households with any handwashing facility.' }
    ]
  },
  {
    slug: 'demographics',
    title: 'Demographics',
    emoji: '👥',
    indicators: [
      { id: 'birth-registration', name: 'Birth Registration', path: '/chapter2/birth-registration', fixedParams: {}, description: 'Percentage of children under 5 with registered births.' },
      { id: 'orphanhood', name: 'Orphanhood', path: '/chapter2/orphanhood', fixedParams: {}, description: 'Percentage of children under 18 who are orphans.' },
      { id: 'education-secondary', name: 'Secondary Education', path: '/chapter2/education-women', fixedParams: { indicator: 'secondary' }, dynamicParams: [{ key: 'gender', label: 'Gender', default: 'all', options: [{ value: 'all', label: 'All' }, { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }] }], description: 'Percentage with secondary education (age 6+).' },
      { id: 'education-higher', name: 'Higher Education', path: '/chapter2/education-women', fixedParams: { indicator: 'higher' }, dynamicParams: [{ key: 'gender', label: 'Gender', default: 'all', options: [{ value: 'all', label: 'All' }, { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }] }], description: 'Percentage with higher education (age 6+).' },
      { id: 'media-exposure', name: 'Media Exposure', path: '/chapter2/media-exposure', fixedParams: {}, dynamicParams: [{ key: 'media_type', label: 'Media Type', default: 'any', options: [{ value: 'any', label: 'Any Media' }, { value: 'newspaper', label: 'Newspaper' }, { value: 'radio', label: 'Radio' }, { value: 'tv', label: 'Television' }] }], description: 'Exposure to mass media among women 15-49.' },
      { id: 'insurance', name: 'Health Insurance', path: '/chapter2/health-insurance', fixedParams: {}, description: 'Percentage of women 15-49 covered by health insurance.' }
    ]
  },
  {
    slug: 'fertility',
    title: 'Fertility & Marriage',
    emoji: '👶',
    indicators: [
      { id: 'fertility-rate', name: 'Total Fertility Rate', path: '/chapter3/fertility-rate', fixedParams: {}, dynamicParams: [{ key: 'rate_type', label: 'Rate Type', default: 'observed', options: [{ value: 'observed', label: 'Observed TFR' }, { value: 'wanted', label: 'Wanted TFR' }] }], description: 'Total Fertility Rate — average children per woman.' },
      { id: 'median-age-first-birth', name: 'Median Age at First Birth', path: '/chapter3/median-age-first-birth', fixedParams: {}, description: 'Median age at first birth for women aged 25-49.' },
      { id: 'median-age-first-marriage', name: 'Median Age at First Marriage', path: '/chapter3/median-age-first-marriage', fixedParams: {}, dynamicParams: [{ key: 'gender', label: 'Gender', default: 'female', options: [{ value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }] }], description: 'Median age at first marriage or union.' },
      { id: 'marital-status', name: 'Marital Status', path: '/chapter2/marital-status', fixedParams: {}, dynamicParams: [{ key: 'status', label: 'Status', default: 'married', options: [{ value: 'married', label: 'Married' }, { value: 'never_married', label: 'Never Married' }, { value: 'living_together', label: 'Living Together' }, { value: 'divorced', label: 'Divorced/Separated' }, { value: 'widowed', label: 'Widowed' }] }], description: 'Marital status distribution among women 15-49.' }
    ]
  },
  {
    slug: 'family-planning',
    title: 'Family Planning',
    emoji: '💊',
    indicators: [
      { id: 'contraception-use', name: 'Contraceptive Prevalence', path: '/chapter4/contraception-use', fixedParams: {}, dynamicParams: [{ key: 'method', label: 'Method', default: 'any', options: [{ value: 'any', label: 'Any Method' }, { value: 'modern', label: 'Modern Methods' }, { value: 'traditional', label: 'Traditional Methods' }] }, { key: 'marital_status', label: 'Marital Status', default: 'married', options: [{ value: 'married', label: 'Married Women' }, { value: 'all_women', label: 'All Women' }] }], description: 'Contraceptive prevalence rate among women 15-49.' },
      { id: 'unmet-need', name: 'Unmet Need for FP', path: '/chapter4/unmet-need', fixedParams: {}, dynamicParams: [{ key: 'need_type', label: 'Need Type', default: 'total', options: [{ value: 'total', label: 'Total Unmet Need' }, { value: 'spacing', label: 'For Spacing' }, { value: 'limiting', label: 'For Limiting' }] }], description: 'Unmet need for family planning among married women.' },
      { id: 'demand-satisfied', name: 'Demand Satisfied', path: '/chapter4/demand-satisfied', fixedParams: {}, description: 'Demand for FP satisfied by modern methods.' },
      { id: 'fp-exposure', name: 'FP Message Exposure', path: '/chapter4/fp-exposure', fixedParams: {}, dynamicParams: [{ key: 'source', label: 'Source', default: 'any', options: [{ value: 'any', label: 'Any Source' }, { value: 'radio', label: 'Radio' }, { value: 'tv', label: 'Television' }, { value: 'health_worker', label: 'Health Worker' }] }, { key: 'gender', label: 'Gender', default: 'female', options: [{ value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }] }], description: 'Exposure to family planning messages.' }
    ]
  },
  {
    slug: 'maternal-health',
    title: 'Maternal Health',
    emoji: '🏥',
    indicators: [
      { id: 'antenatal-care', name: 'Antenatal Care', path: '/chapter5/antenatal-care', fixedParams: {}, dynamicParams: [{ key: 'indicator', label: 'Indicator', default: 'skilled_provider', options: [{ value: 'skilled_provider', label: 'Skilled ANC Provider' }, { value: 'four_visits', label: '4+ ANC Visits' }] }], description: 'Antenatal care coverage for births in the last 5 years.' },
      { id: 'delivery-place', name: 'Place of Delivery', path: '/chapter5/delivery-place', fixedParams: {}, dynamicParams: [{ key: 'place', label: 'Place', default: 'health_facility', options: [{ value: 'health_facility', label: 'Health Facility' }, { value: 'hospital', label: 'Hospital' }, { value: 'health_center', label: 'Health Center' }, { value: 'home', label: 'Home' }] }], description: 'Place of delivery for births in the last 5 years.' },
      { id: 'delivery-assistance', name: 'Delivery Assistance', path: '/chapter5/delivery-assistance', fixedParams: {}, dynamicParams: [{ key: 'provider', label: 'Provider', default: 'skilled', options: [{ value: 'skilled', label: 'Skilled Provider' }, { value: 'doctor', label: 'Doctor' }, { value: 'nurse', label: 'Nurse/Midwife' }, { value: 'traditional', label: 'Traditional Birth Attendant' }] }], description: 'Type of delivery assistance provider.' },
      { id: 'postnatal-care', name: 'Postnatal Care', path: '/chapter5/postnatal-care', fixedParams: {}, dynamicParams: [{ key: 'target', label: 'Target', default: 'women', options: [{ value: 'women', label: 'Mothers' }, { value: 'newborn', label: 'Newborns' }] }], description: 'Postnatal checkup within 2 days of birth.' },
      { id: 'tetanus-protection', name: 'Tetanus Protection', path: '/chapter5/tetanus-protection', fixedParams: {}, description: 'Neonatal tetanus protection (2+ TT doses).' }
    ]
  },
  {
    slug: 'child-health',
    title: 'Child Health',
    emoji: '🛡️',
    indicators: [
      { id: 'diarrhea', name: 'Diarrhea Prevalence', path: '/chapter6/diarrhea', fixedParams: {}, description: 'Prevalence of diarrhea in children under 5 (last 2 weeks).' },
      { id: 'fever', name: 'Fever Prevalence', path: '/chapter6/fever', fixedParams: {}, description: 'Prevalence of fever in children under 5 (last 2 weeks).' },
      { id: 'ari', name: 'ARI Symptoms', path: '/chapter6/ari', fixedParams: {}, description: 'Prevalence of acute respiratory infection symptoms (children < 5).' },
      { id: 'diarrhea-treatment', name: 'Diarrhea Treatment', path: '/chapter6/diarrhea-treatment', fixedParams: {}, dynamicParams: [{ key: 'treatment', label: 'Treatment', default: 'ors', options: [{ value: 'ors', label: 'ORS' }, { value: 'zinc', label: 'Zinc' }, { value: 'ors_and_zinc', label: 'ORS + Zinc' }] }], description: 'Children with diarrhea receiving treatment.' },
      { id: 'anemia-children', name: 'Anemia (Children)', path: '/chapter6/anemia-children', fixedParams: {}, dynamicParams: [{ key: 'severity', label: 'Severity', default: 'any', options: [{ value: 'any', label: 'Any Anemia' }, { value: 'mild', label: 'Mild' }, { value: 'moderate', label: 'Moderate' }, { value: 'severe', label: 'Severe' }] }], description: 'Anemia prevalence among children 6-59 months.' }
    ]
  },
  {
    slug: 'nutrition',
    title: 'Nutrition',
    emoji: '🥗',
    indicators: [
      { id: 'stunting', name: 'Stunting (Children)', path: '/chapter7/stunting', fixedParams: {}, dynamicParams: [{ key: 'severity', label: 'Severity', default: 'any', options: [{ value: 'any', label: 'Any (< -2 SD)' }, { value: 'moderate', label: 'Moderate' }, { value: 'severe', label: 'Severe (< -3 SD)' }] }], description: 'Height-for-age stunting prevalence in children under 5.' },
      { id: 'wasting', name: 'Wasting (Children)', path: '/chapter7/wasting', fixedParams: {}, dynamicParams: [{ key: 'severity', label: 'Severity', default: 'any', options: [{ value: 'any', label: 'Any (< -2 SD)' }, { value: 'moderate', label: 'Moderate' }, { value: 'severe', label: 'Severe (< -3 SD)' }] }], description: 'Weight-for-height wasting prevalence in children under 5.' },
      { id: 'underweight', name: 'Underweight (Children)', path: '/chapter7/underweight', fixedParams: {}, dynamicParams: [{ key: 'severity', label: 'Severity', default: 'any', options: [{ value: 'any', label: 'Any (< -2 SD)' }, { value: 'moderate', label: 'Moderate' }, { value: 'severe', label: 'Severe (< -3 SD)' }] }], description: 'Weight-for-age underweight prevalence in children under 5.' },
      { id: 'overweight-children', name: 'Overweight (Children)', path: '/chapter7/overweight-children', fixedParams: {}, description: 'Overweight prevalence in children under 5 (WHZ > +2 SD).' },
      { id: 'women-bmi', name: "Women's BMI", path: '/chapter7/women-bmi', fixedParams: {}, dynamicParams: [{ key: 'category', label: 'BMI Category', default: 'underweight', options: [{ value: 'underweight', label: 'Underweight (< 18.5)' }, { value: 'normal', label: 'Normal (18.5–24.9)' }, { value: 'overweight', label: 'Overweight (25–29.9)' }, { value: 'obese', label: 'Obese (≥ 30)' }] }], description: 'BMI categories for non-pregnant women 15-49.' },
      { id: 'anemia-women', name: 'Anemia (Women)', path: '/chapter7/anemia-women', fixedParams: {}, dynamicParams: [{ key: 'severity', label: 'Severity', default: 'any', options: [{ value: 'any', label: 'Any Anemia' }, { value: 'mild', label: 'Mild' }, { value: 'moderate', label: 'Moderate' }, { value: 'severe', label: 'Severe' }] }], description: 'Anemia prevalence among women 15-49.' }
    ]
  },
  {
    slug: 'malaria',
    title: 'Malaria',
    emoji: '🦟',
    indicators: [
      { id: 'itn-ownership', name: 'ITN Ownership', path: '/chapter8/itn-ownership', fixedParams: {}, description: 'Percentage of households owning at least one insecticide-treated net.' },
      { id: 'itn-usage-population', name: 'ITN Usage (Population)', path: '/chapter8/itn-usage-population', fixedParams: {}, description: 'Percentage of population that slept under an ITN last night.' },
      { id: 'itn-usage-children', name: 'ITN Usage (Children < 5)', path: '/chapter8/itn-usage-children', fixedParams: {}, description: 'Percentage of children under 5 that slept under an ITN last night.' },
      { id: 'itn-usage-pregnant', name: 'ITN Usage (Pregnant Women)', path: '/chapter8/itn-usage-pregnant', fixedParams: {}, description: 'Percentage of pregnant women that slept under an ITN last night.' },
      { id: 'malaria-prevalence', name: 'Malaria Prevalence (Children)', path: '/chapter8/malaria-prevalence-children', fixedParams: {}, dynamicParams: [{ key: 'test_type', label: 'Test Type', default: 'rdt', options: [{ value: 'rdt', label: 'Rapid Diagnostic Test (RDT)' }, { value: 'microscopy', label: 'Microscopy' }] }], description: 'Malaria prevalence in children 6-59 months by test type.' },
      { id: 'fever-treatment', name: 'Fever Treatment', path: '/chapter8/fever-treatment', fixedParams: {}, dynamicParams: [{ key: 'treatment', label: 'Treatment', default: 'any_antimalarial', options: [{ value: 'any_antimalarial', label: 'Any Antimalarial' }, { value: 'act', label: 'ACT' }, { value: 'blood_test', label: 'Blood Test Received' }] }], description: 'Treatment sought for febrile children under 5.' }
    ]
  },
  {
    slug: 'hiv-aids',
    title: 'HIV/AIDS & STIs',
    emoji: '🔬',
    indicators: [
      { id: 'hiv-knowledge', name: 'Comprehensive HIV Knowledge', path: '/chapter9/hiv-knowledge-comprehensive', fixedParams: {}, dynamicParams: [{ key: 'gender', label: 'Gender', default: 'female', options: [{ value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }] }], description: 'Comprehensive HIV prevention knowledge among adults 15-49.' },
      { id: 'hiv-testing', name: 'HIV Testing', path: '/chapter9/hiv-testing', fixedParams: {}, dynamicParams: [{ key: 'gender', label: 'Gender', default: 'female', options: [{ value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }] }, { key: 'timing', label: 'Timing', default: 'ever', options: [{ value: 'ever', label: 'Ever Tested' }, { value: 'last_12_months', label: 'Last 12 Months' }] }], description: 'HIV testing coverage among adults 15-49.' },
      { id: 'multiple-partners', name: 'Multiple Sexual Partners', path: '/chapter9/multiple-partners', fixedParams: {}, dynamicParams: [{ key: 'gender', label: 'Gender', default: 'male', options: [{ value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }] }], description: 'Percentage with 2+ sexual partners in last 12 months.' },
      { id: 'condom-use', name: 'Condom Use (Multiple Partners)', path: '/chapter9/condom-use-multiple-partners', fixedParams: {}, dynamicParams: [{ key: 'gender', label: 'Gender', default: 'male', options: [{ value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }] }], description: 'Condom use at last sex among those with multiple partners.' },
      { id: 'sti-symptoms', name: 'STI Symptoms', path: '/chapter9/sti-symptoms', fixedParams: {}, dynamicParams: [{ key: 'gender', label: 'Gender', default: 'female', options: [{ value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }] }], description: 'Prevalence of STI symptoms in last 12 months.' },
      { id: 'circumcision', name: 'Male Circumcision', path: '/chapter9/circumcision', fixedParams: {}, description: 'Prevalence of male circumcision.' }
    ]
  },
  {
    slug: 'gender',
    title: 'Gender Empowerment',
    emoji: '⚖️',
    indicators: [
      { id: 'decision-making', name: 'Women Decision-Making', path: '/chapter10/decision-making', fixedParams: {}, dynamicParams: [{ key: 'decision_type', label: 'Decision Type', default: 'all_three', options: [{ value: 'all_three', label: 'All Three Decisions' }, { value: 'own_healthcare', label: 'Own Healthcare' }, { value: 'household_purchases', label: 'Household Purchases' }, { value: 'visits', label: 'Visits to Family' }, { value: 'none', label: 'No Decisions' }] }], description: "Women's participation in household decision-making." },
      { id: 'attitude-violence', name: 'Attitudes on Violence', path: '/chapter10/attitude-violence', fixedParams: {}, dynamicParams: [{ key: 'gender', label: 'Gender', default: 'female', options: [{ value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }] }, { key: 'reason', label: 'Reason', default: 'any', options: [{ value: 'any', label: 'Any Reason' }, { value: 'burns_food', label: 'Burns Food' }, { value: 'argues', label: 'Argues' }, { value: 'goes_out', label: 'Goes Out Without Telling' }, { value: 'neglects_children', label: 'Neglects Children' }, { value: 'refuses_sex', label: 'Refuses Sex' }] }], description: 'Attitudes justifying wife beating.' },
      { id: 'earnings-control', name: "Control of Women's Earnings", path: '/chapter10/earnings-control-women', fixedParams: {}, dynamicParams: [{ key: 'control_level', label: 'Decision Maker', default: 'self', options: [{ value: 'self', label: 'Woman Decides' }, { value: 'jointly', label: 'Jointly' }, { value: 'husband', label: 'Husband Decides' }] }], description: "Who decides how the wife's cash earnings are used." },
      { id: 'earnings-comparison', name: "Earnings Comparison", path: '/chapter10/earnings-control-men', fixedParams: {}, dynamicParams: [{ key: 'comparison', label: 'Comparison', default: 'more', options: [{ value: 'more', label: "Wife Earns More" }, { value: 'about_same', label: 'About the Same' }, { value: 'less', label: 'Wife Earns Less' }] }], description: "Wife's earnings relative to husband's earnings." }
    ]
  }
];
