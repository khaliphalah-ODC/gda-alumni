import parade from './excellence/parade.webp';
import graduation from './excellence/graduation.webp';
import type { SchoolPhoto } from './school-photos';

export interface ExcellenceAchievement {
  id: string;
  category: string;
  title: string;
  description: string;
  heading: string;
  date: string;
  dateLabel: string;
  details: string;
  source: { url: string; label: string };
  photo: SchoolPhoto;
}

// Static editorial selections from the implementation brief, separate from the
// live, Admin-published HISTORY records. Photos illustrate school activities;
// their dates and participants are not evidence for the cited achievements.
export const excellenceAchievements: readonly ExcellenceAchievement[] = [
  {
    id: 'cadet-drill', category: 'Parade & Cadet Drill Excellence',
    title: 'Precision, Discipline & Unity',
    description: "From coordinated marching formations to ceremonial parades, Gray D. Allison's cadet drill activities represent teamwork, discipline, and commitment.",
    heading: 'National Flag Day Cadet Corps Drill', date: '2017', dateLabel: '2017',
    details: "In 2017, Gray D. Allison High School placed third in Liberia's National Flag Day Cadet Corps Drill competition, which featured 29 participating schools.",
    source: { url: 'https://mod.gov.lr/liberia-celebrates-170th-national-flag-day/', label: 'Ministry of National Defense · National Flag Day report' },
    photo: { id: 'excellence-parade', src: parade, width: 960, height: 538, category: 'Parade', alt: 'Cadets in blue and black uniforms marching with flags in front of a blue building.', caption: 'School parade photograph · event date not identified' },
  },
  {
    id: 'academic-excellence', category: 'Academic Excellence',
    title: 'A Tradition of Academic Achievement',
    description: "Celebrating the dedication of students, teachers, and administrators whose achievements continue to strengthen the school's academic record.",
    heading: 'Reported WASSCE Achievement', date: '2026-09', dateLabel: 'September 2026',
    details: 'In September 2026, the Ministry of National Defense reported a 100% WASSCE pass rate for Gray D. Allison High School.',
    source: { url: 'https://www.facebook.com/modliberia/posts/1492531776241236/', label: 'Ministry of National Defense · reported result on Facebook' },
    photo: { id: 'excellence-graduation', src: graduation, width: 768, height: 1024, category: 'Graduation', alt: 'Graduates gathered outdoors in black caps and gowns with blue stoles.', caption: 'School graduation photograph · graduating year not identified' },
  },
];
