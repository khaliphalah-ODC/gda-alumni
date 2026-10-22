// Original photographs are imported unchanged. Names/captions describe visible
// content only; a filename is not evidence of a person's identity or event date.
import ministryGroup from '../../../images/heroimage1.jpg';
import schoolGroup from '../../../images/image2.jpg';
import flagParade from '../../../images/image4.jpg';
import flagBearers from '../../../images/image3.jpg';
import band from '../../../images/paraimage4.jpg';
import streetBand from '../../../images/paraimage.jpg';
import percussion from '../../../images/paraimage2.jpg';
import schoolMusicians from '../../../images/sectionimage1.jpg';
import community from '../../../images/upcoming1.jpg';
import graduates from '../../../images/graduaimage1.jpg';
import graduatesTogether from '../../../images/graduaimage2.jpg';

export interface SchoolPhoto {
  id: string; src: string; width: number; height: number;
  alt: string; caption: string; category: 'School life' | 'Parade' | 'Graduation';
}
export const schoolPhotos = {
  ministryGroup: { id: 'ministry-group', src: ministryGroup, width: 1600, height: 1066, alt: 'Students in blue uniforms gathered beside the Ministry of National Defense welcome sign.', caption: 'School community', category: 'School life' },
  schoolGroup: { id: 'school-group', src: schoolGroup, width: 722, height: 480, alt: 'Students in blue uniforms smiling together outside a blue school building.', caption: 'Together at school', category: 'School life' },
  flagParade: { id: 'flag-parade', src: flagParade, width: 1079, height: 605, alt: 'Students carrying flags as they march in front of a blue building.', caption: 'Flags on parade', category: 'Parade' },
  flagBearers: { id: 'flag-bearers', src: flagBearers, width: 1079, height: 605, alt: 'Flag bearers in blue uniforms marching together outdoors.', caption: 'Student flag bearers', category: 'Parade' },
  band: { id: 'school-band', src: band, width: 2048, height: 1152, alt: 'A marching band in blue uniforms with brass instruments and a Liberian flag.', caption: 'The marching band', category: 'Parade' },
  streetBand: { id: 'street-band', src: streetBand, width: 960, height: 720, alt: 'School musicians in blue uniforms marching along a street.', caption: 'Music in the community', category: 'Parade' },
  percussion: { id: 'percussion', src: percussion, width: 960, height: 540, alt: 'Students carrying drums in a marching band outdoors.', caption: 'The percussion section', category: 'Parade' },
  schoolMusicians: { id: 'school-musicians', src: schoolMusicians, width: 1280, height: 960, alt: 'Students standing together with percussion instruments outside.', caption: 'Student musicians', category: 'School life' },
  community: { id: 'alumni-community', src: community, width: 1536, height: 2048, alt: 'A school community group beside a G.D.A. Alumni banner and a blue building.', caption: 'Our alumni community', category: 'School life' },
  graduates: { id: 'graduates', src: graduates, width: 1536, height: 2048, alt: 'A group of graduates wearing black caps and gowns with blue stoles outdoors.', caption: 'Graduates together', category: 'Graduation' },
  graduatesTogether: { id: 'graduates-together', src: graduatesTogether, width: 1536, height: 2048, alt: 'Graduates gathered outdoors in black gowns and blue stoles.', caption: 'A graduation gathering', category: 'Graduation' },
} as const satisfies Record<string, SchoolPhoto>;

export const heroPhotos: SchoolPhoto[] = [schoolPhotos.ministryGroup, schoolPhotos.flagParade, schoolPhotos.band];
export const galleryPhotos: SchoolPhoto[] = Object.values(schoolPhotos);
