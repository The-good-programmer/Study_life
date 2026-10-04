export interface CountryEducationConfig {
  code: string;
  name: string;
  flag: string;
  systemName: string;
  grades: {
    label: string;
    typicalAge: number;
    stage: 'Primary / Elementary' | 'Middle / Secondary' | 'High School' | 'Higher Education / Adult';
  }[];
}

export const EDUCATION_COUNTRIES: CountryEducationConfig[] = [
  {
    code: 'US',
    name: 'United States',
    flag: '🇺🇸',
    systemName: 'K-12 & College',
    grades: [
      { label: '3rd Grade', typicalAge: 8, stage: 'Primary / Elementary' },
      { label: '4th Grade', typicalAge: 9, stage: 'Primary / Elementary' },
      { label: '5th Grade', typicalAge: 10, stage: 'Primary / Elementary' },
      { label: '6th Grade (Middle School)', typicalAge: 11, stage: 'Middle / Secondary' },
      { label: '7th Grade (Middle School)', typicalAge: 12, stage: 'Middle / Secondary' },
      { label: '8th Grade (Middle School)', typicalAge: 13, stage: 'Middle / Secondary' },
      { label: '9th Grade (High School Freshman)', typicalAge: 14, stage: 'High School' },
      { label: '10th Grade (High School Sophomore)', typicalAge: 15, stage: 'High School' },
      { label: '11th Grade (High School Junior / AP)', typicalAge: 16, stage: 'High School' },
      { label: '12th Grade (High School Senior)', typicalAge: 17, stage: 'High School' },
      { label: 'College / Undergrad (Freshman/Sophomore)', typicalAge: 19, stage: 'Higher Education / Adult' },
      { label: 'College / Undergrad (Junior/Senior)', typicalAge: 21, stage: 'Higher Education / Adult' },
      { label: 'Graduate / Medical / Specialist', typicalAge: 24, stage: 'Higher Education / Adult' },
    ],
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    flag: '🇬🇧',
    systemName: 'National Curriculum (Key Stages & GCSE/A-Levels)',
    grades: [
      { label: 'Year 4 (Primary)', typicalAge: 8, stage: 'Primary / Elementary' },
      { label: 'Year 5 (Primary)', typicalAge: 9, stage: 'Primary / Elementary' },
      { label: 'Year 6 (Primary)', typicalAge: 10, stage: 'Primary / Elementary' },
      { label: 'Year 7 (Secondary / KS3)', typicalAge: 11, stage: 'Middle / Secondary' },
      { label: 'Year 8 (Secondary / KS3)', typicalAge: 12, stage: 'Middle / Secondary' },
      { label: 'Year 9 (Secondary / KS3)', typicalAge: 13, stage: 'Middle / Secondary' },
      { label: 'Year 10 (GCSE)', typicalAge: 14, stage: 'High School' },
      { label: 'Year 11 (GCSE)', typicalAge: 15, stage: 'High School' },
      { label: 'Year 12 (Sixth Form / A-Levels)', typicalAge: 16, stage: 'High School' },
      { label: 'Year 13 (Sixth Form / A-Levels)', typicalAge: 17, stage: 'High School' },
      { label: 'University Undergraduate', typicalAge: 20, stage: 'Higher Education / Adult' },
      { label: 'Postgraduate / Master / PhD', typicalAge: 24, stage: 'Higher Education / Adult' },
    ],
  },
  {
    code: 'TR',
    name: 'Turkey',
    flag: '🇹🇷',
    systemName: 'MEB & YÖK',
    grades: [
      { label: '3. Sınıf (İlkokul)', typicalAge: 8, stage: 'Primary / Elementary' },
      { label: '4. Sınıf (İlkokul)', typicalAge: 9, stage: 'Primary / Elementary' },
      { label: '5. Sınıf (Ortaokul)', typicalAge: 10, stage: 'Middle / Secondary' },
      { label: '6. Sınıf (Ortaokul)', typicalAge: 11, stage: 'Middle / Secondary' },
      { label: '7. Sınıf (Ortaokul)', typicalAge: 12, stage: 'Middle / Secondary' },
      { label: '8. Sınıf (LGS Hazırlık)', typicalAge: 13, stage: 'Middle / Secondary' },
      { label: '9. Sınıf (Lise)', typicalAge: 14, stage: 'High School' },
      { label: '10. Sınıf (Lise)', typicalAge: 15, stage: 'High School' },
      { label: '11. Sınıf (Lise / Alan Seçimi)', typicalAge: 16, stage: 'High School' },
      { label: '12. Sınıf (YKS Hazırlık / Mezun)', typicalAge: 17, stage: 'High School' },
      { label: 'Üniversite (Ön Lisans / Lisans 1-2)', typicalAge: 19, stage: 'Higher Education / Adult' },
      { label: 'Üniversite (Lisans 3-4)', typicalAge: 21, stage: 'Higher Education / Adult' },
      { label: 'Yüksek Lisans / Doktora / TUS', typicalAge: 24, stage: 'Higher Education / Adult' },
    ],
  },
  {
    code: 'CA',
    name: 'Canada',
    flag: '🇨🇦',
    systemName: 'K-12 & CEGEP/University',
    grades: [
      { label: 'Grade 4 (Elementary)', typicalAge: 9, stage: 'Primary / Elementary' },
      { label: 'Grade 5 (Elementary)', typicalAge: 10, stage: 'Primary / Elementary' },
      { label: 'Grade 6 (Middle School)', typicalAge: 11, stage: 'Middle / Secondary' },
      { label: 'Grade 7 (Middle School)', typicalAge: 12, stage: 'Middle / Secondary' },
      { label: 'Grade 8 (Middle School)', typicalAge: 13, stage: 'Middle / Secondary' },
      { label: 'Grade 9 (High School)', typicalAge: 14, stage: 'High School' },
      { label: 'Grade 10 (High School)', typicalAge: 15, stage: 'High School' },
      { label: 'Grade 11 (High School)', typicalAge: 16, stage: 'High School' },
      { label: 'Grade 12 (High School / Pre-U)', typicalAge: 17, stage: 'High School' },
      { label: 'CEGEP / College Diploma', typicalAge: 18, stage: 'Higher Education / Adult' },
      { label: 'University Undergraduate', typicalAge: 20, stage: 'Higher Education / Adult' },
      { label: 'Graduate Studies', typicalAge: 24, stage: 'Higher Education / Adult' },
    ],
  },
  {
    code: 'DE',
    name: 'Germany',
    flag: '🇩🇪',
    systemName: 'Grundschule & Gymnasium / Realschule',
    grades: [
      { label: '4. Klasse (Grundschule)', typicalAge: 9, stage: 'Primary / Elementary' },
      { label: '5. Klasse (Orientierungsstufe)', typicalAge: 10, stage: 'Middle / Secondary' },
      { label: '6. Klasse', typicalAge: 11, stage: 'Middle / Secondary' },
      { label: '7. Klasse', typicalAge: 12, stage: 'Middle / Secondary' },
      { label: '8. Klasse', typicalAge: 13, stage: 'Middle / Secondary' },
      { label: '9. Klasse', typicalAge: 14, stage: 'High School' },
      { label: '10. Klasse (Mittlere Reife)', typicalAge: 15, stage: 'High School' },
      { label: '11. Klasse (Gymnasiale Oberstufe)', typicalAge: 16, stage: 'High School' },
      { label: '12./13. Klasse (Abitur)', typicalAge: 17, stage: 'High School' },
      { label: 'Universität / Fachhochschule (Bachelor)', typicalAge: 20, stage: 'Higher Education / Adult' },
      { label: 'Universität (Master / Promotion)', typicalAge: 24, stage: 'Higher Education / Adult' },
    ],
  },
  {
    code: 'FR',
    name: 'France',
    flag: '🇫🇷',
    systemName: 'Éducation Nationale (Primaire, Collège, Lycée)',
    grades: [
      { label: 'CM1 (Primaire)', typicalAge: 9, stage: 'Primary / Elementary' },
      { label: 'CM2 (Primaire)', typicalAge: 10, stage: 'Primary / Elementary' },
      { label: '6ème (Collège)', typicalAge: 11, stage: 'Middle / Secondary' },
      { label: '5ème (Collège)', typicalAge: 12, stage: 'Middle / Secondary' },
      { label: '4ème (Collège)', typicalAge: 13, stage: 'Middle / Secondary' },
      { label: '3ème (Collège / Brevet)', typicalAge: 14, stage: 'High School' },
      { label: 'Seconde (Lycée)', typicalAge: 15, stage: 'High School' },
      { label: 'Première (Lycée / Bac)', typicalAge: 16, stage: 'High School' },
      { label: 'Terminale (Lycée / Bac)', typicalAge: 17, stage: 'High School' },
      { label: 'Université / Licence / Prépa', typicalAge: 19, stage: 'Higher Education / Adult' },
      { label: 'Master / Doctorat / Grandes Écoles', typicalAge: 23, stage: 'Higher Education / Adult' },
    ],
  },
  {
    code: 'IN',
    name: 'India',
    flag: '🇮🇳',
    systemName: 'CBSE, ICSE & State Boards',
    grades: [
      { label: 'Class 4 (Primary)', typicalAge: 9, stage: 'Primary / Elementary' },
      { label: 'Class 5 (Primary)', typicalAge: 10, stage: 'Primary / Elementary' },
      { label: 'Class 6 (Middle School)', typicalAge: 11, stage: 'Middle / Secondary' },
      { label: 'Class 7 (Middle School)', typicalAge: 12, stage: 'Middle / Secondary' },
      { label: 'Class 8 (Middle School)', typicalAge: 13, stage: 'Middle / Secondary' },
      { label: 'Class 9 (Secondary)', typicalAge: 14, stage: 'High School' },
      { label: 'Class 10 (Board Exams / Matriculation)', typicalAge: 15, stage: 'High School' },
      { label: 'Class 11 (Higher Secondary / JEE/NEET)', typicalAge: 16, stage: 'High School' },
      { label: 'Class 12 (Board Exams / Senior Secondary)', typicalAge: 17, stage: 'High School' },
      { label: 'Undergraduate (B.Tech, MBBS, B.Sc, B.Com)', typicalAge: 20, stage: 'Higher Education / Adult' },
      { label: 'Postgraduate / Master / PhD', typicalAge: 24, stage: 'Higher Education / Adult' },
    ],
  },
  {
    code: 'AU',
    name: 'Australia',
    flag: '🇦🇺',
    systemName: 'Australian Curriculum & ATAR',
    grades: [
      { label: 'Year 4 (Primary)', typicalAge: 9, stage: 'Primary / Elementary' },
      { label: 'Year 5 (Primary)', typicalAge: 10, stage: 'Primary / Elementary' },
      { label: 'Year 6 (Primary)', typicalAge: 11, stage: 'Primary / Elementary' },
      { label: 'Year 7 (Junior High)', typicalAge: 12, stage: 'Middle / Secondary' },
      { label: 'Year 8 (Junior High)', typicalAge: 13, stage: 'Middle / Secondary' },
      { label: 'Year 9 (Junior High)', typicalAge: 14, stage: 'Middle / Secondary' },
      { label: 'Year 10 (High School)', typicalAge: 15, stage: 'High School' },
      { label: 'Year 11 (Senior Secondary / HSC / VCE)', typicalAge: 16, stage: 'High School' },
      { label: 'Year 12 (ATAR / Senior Secondary)', typicalAge: 17, stage: 'High School' },
      { label: 'University Undergraduate', typicalAge: 20, stage: 'Higher Education / Adult' },
      { label: 'Postgraduate Studies', typicalAge: 24, stage: 'Higher Education / Adult' },
    ],
  },
  {
    code: 'ES',
    name: 'Spain / Latin America',
    flag: '🇪🇸',
    systemName: 'Primaria, ESO, Bachillerato',
    grades: [
      { label: '4º Primaria', typicalAge: 9, stage: 'Primary / Elementary' },
      { label: '5º Primaria', typicalAge: 10, stage: 'Primary / Elementary' },
      { label: '6º Primaria', typicalAge: 11, stage: 'Primary / Elementary' },
      { label: '1º ESO (Secundaria)', typicalAge: 12, stage: 'Middle / Secondary' },
      { label: '2º ESO (Secundaria)', typicalAge: 13, stage: 'Middle / Secondary' },
      { label: '3º ESO (Secundaria)', typicalAge: 14, stage: 'High School' },
      { label: '4º ESO (Graduado)', typicalAge: 15, stage: 'High School' },
      { label: '1º Bachillerato', typicalAge: 16, stage: 'High School' },
      { label: '2º Bachillerato (Selectividad / EvAU)', typicalAge: 17, stage: 'High School' },
      { label: 'Universidad (Grado)', typicalAge: 20, stage: 'Higher Education / Adult' },
      { label: 'Máster / Doctorado', typicalAge: 24, stage: 'Higher Education / Adult' },
    ],
  },
  {
    code: 'INTL',
    name: 'International / Other',
    flag: '🌍',
    systemName: 'International Standard & IB',
    grades: [
      { label: 'Grade 3 (Primary)', typicalAge: 8, stage: 'Primary / Elementary' },
      { label: 'Grade 4 (Primary)', typicalAge: 9, stage: 'Primary / Elementary' },
      { label: 'Grade 5 (Primary / IB PYP)', typicalAge: 10, stage: 'Primary / Elementary' },
      { label: 'Grade 6 (Middle School / IB MYP)', typicalAge: 11, stage: 'Middle / Secondary' },
      { label: 'Grade 7 (Middle School / IB MYP)', typicalAge: 12, stage: 'Middle / Secondary' },
      { label: 'Grade 8 (Middle School / IB MYP)', typicalAge: 13, stage: 'Middle / Secondary' },
      { label: 'Grade 9 (High School / IGCSE)', typicalAge: 14, stage: 'High School' },
      { label: 'Grade 10 (High School / IGCSE)', typicalAge: 15, stage: 'High School' },
      { label: 'Grade 11 (High School / IB DP 1 / AP)', typicalAge: 16, stage: 'High School' },
      { label: 'Grade 12 (High School / IB DP 2)', typicalAge: 17, stage: 'High School' },
      { label: 'University / Undergraduate', typicalAge: 20, stage: 'Higher Education / Adult' },
      { label: 'Postgraduate / Master / Doctorate', typicalAge: 24, stage: 'Higher Education / Adult' },
    ],
  }
];

export class EducationCatalog {
  public static getAllCountries(): CountryEducationConfig[] {
    return EDUCATION_COUNTRIES;
  }

  public static getCountry(nameOrCode: string): CountryEducationConfig {
    const match = EDUCATION_COUNTRIES.find(
      c => c.name.toLowerCase() === nameOrCode.toLowerCase() || c.code.toLowerCase() === nameOrCode.toLowerCase()
    );
    return match || EDUCATION_COUNTRIES[0];
  }

  public static getFlag(countryName: string): string {
    const c = EDUCATION_COUNTRIES.find(item => item.name.toLowerCase() === countryName.toLowerCase() || item.code.toLowerCase() === countryName.toLowerCase());
    return c?.flag || '🌍';
  }

  public static getGradesForCountry(countryName: string): { label: string; typicalAge: number; stage: string }[] {
    const country = this.getCountry(countryName);
    return country.grades;
  }

  public static getTypicalAge(countryName: string, gradeLabel: string): number {
    const grades = this.getGradesForCountry(countryName);
    const match = grades.find(g => g.label.toLowerCase() === gradeLabel.toLowerCase());
    return match ? match.typicalAge : 15;
  }
}
