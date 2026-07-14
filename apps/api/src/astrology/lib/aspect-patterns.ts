import type { Aspect, AspectPattern, Planet } from '@pl-cms/shared';

function getAngleBetweenPlanets(planet1: Planet, planet2: Planet): number {
  let angle = Math.abs(planet1.longitude - planet2.longitude);
  if (angle > 180) angle = 360 - angle;
  return angle;
}

function hasAspect(planet1: string, planet2: string, aspectType: string, aspects: Aspect[]): boolean {
  return aspects.some(
    (asp) =>
      (asp.planet1 === planet1 && asp.planet2 === planet2 && asp.type === aspectType) ||
      (asp.planet1 === planet2 && asp.planet2 === planet1 && asp.type === aspectType),
  );
}

function getElementFromSign(sign: string): string {
  if (['Aries', 'Leo', 'Sagittarius'].includes(sign)) return 'Fire';
  if (['Taurus', 'Virgo', 'Capricorn'].includes(sign)) return 'Earth';
  if (['Gemini', 'Libra', 'Aquarius'].includes(sign)) return 'Air';
  if (['Cancer', 'Scorpio', 'Pisces'].includes(sign)) return 'Water';
  return 'Unknown';
}

function getModalityFromSign(sign: string): string {
  if (['Aries', 'Cancer', 'Libra', 'Capricorn'].includes(sign)) return 'Cardinal';
  if (['Taurus', 'Leo', 'Scorpio', 'Aquarius'].includes(sign)) return 'Fixed';
  if (['Gemini', 'Virgo', 'Sagittarius', 'Pisces'].includes(sign)) return 'Mutable';
  return 'Unknown';
}

function detectTSquares(planets: Planet[], aspects: Aspect[]): AspectPattern[] {
  const patterns: AspectPattern[] = [];

  for (let i = 0; i < planets.length; i += 1) {
    for (let j = i + 1; j < planets.length; j += 1) {
      if (hasAspect(planets[i].name, planets[j].name, 'Opposition', aspects)) {
        for (let k = 0; k < planets.length; k += 1) {
          if (k !== i && k !== j) {
            const hasSquare1 = hasAspect(planets[i].name, planets[k].name, 'Square', aspects);
            const hasSquare2 = hasAspect(planets[j].name, planets[k].name, 'Square', aspects);

            if (hasSquare1 && hasSquare2) {
              const patternPlanets = [planets[i].name, planets[j].name, planets[k].name];
              const alreadyExists = patterns.some(
                (p) => p.type === 'T-Square' && p.planets.slice().sort().join(',') === patternPlanets.slice().sort().join(','),
              );

              if (!alreadyExists) {
                const modality = getModalityFromSign(planets[k].sign);
                patterns.push({
                  type: 'T-Square',
                  planets: patternPlanets,
                  description: `${planets[k].name} squares ${planets[i].name} and ${planets[j].name} (which oppose each other)`,
                  modality,
                  color: 'oklch(0.60 0.22 40)',
                  interpretation: `This T-Square creates dynamic tension that demands action and resolution. ${planets[k].name} is the focal point, receiving pressure from both ${planets[i].name} and ${planets[j].name}. The ${modality} modality suggests this tension manifests through ${modality === 'Cardinal' ? 'initiating action and leadership challenges' : modality === 'Fixed' ? 'resistance to change and stubborn patterns' : 'scattered energy and adaptability issues'}. Working constructively with this pattern requires conscious effort to balance these planetary energies.`,
                });
              }
            }
          }
        }
      }
    }
  }

  return patterns;
}

function detectGrandTrines(planets: Planet[], aspects: Aspect[]): AspectPattern[] {
  const patterns: AspectPattern[] = [];

  for (let i = 0; i < planets.length; i += 1) {
    for (let j = i + 1; j < planets.length; j += 1) {
      for (let k = j + 1; k < planets.length; k += 1) {
        const hasTrine1 = hasAspect(planets[i].name, planets[j].name, 'Trine', aspects);
        const hasTrine2 = hasAspect(planets[j].name, planets[k].name, 'Trine', aspects);
        const hasTrine3 = hasAspect(planets[k].name, planets[i].name, 'Trine', aspects);

        if (hasTrine1 && hasTrine2 && hasTrine3) {
          const element = getElementFromSign(planets[i].sign);
          patterns.push({
            type: 'Grand Trine',
            planets: [planets[i].name, planets[j].name, planets[k].name],
            description: `${planets[i].name}, ${planets[j].name}, and ${planets[k].name} form a harmonious triangle`,
            element,
            color: 'oklch(0.70 0.20 150)',
            interpretation: `This Grand Trine in ${element} signs creates a flowing circuit of harmonious energy. ${element === 'Fire' ? 'You have natural enthusiasm, creativity, and inspirational gifts that flow easily.' : element === 'Earth' ? 'You possess practical abilities, resourcefulness, and material stability that come naturally.' : element === 'Air' ? 'You have intellectual gifts, communication talents, and social ease that manifest effortlessly.' : 'You have emotional intelligence, intuitive abilities, and empathic gifts that are innate.'} While this is a blessing, be aware that Grand Trines can lead to complacency—these gifts may not be fully developed without conscious effort.`,
          });
        }
      }
    }
  }

  return patterns;
}

function detectGrandCrosses(planets: Planet[], aspects: Aspect[]): AspectPattern[] {
  const patterns: AspectPattern[] = [];

  for (let i = 0; i < planets.length; i += 1) {
    for (let j = i + 1; j < planets.length; j += 1) {
      for (let k = j + 1; k < planets.length; k += 1) {
        for (let l = k + 1; l < planets.length; l += 1) {
          const hasOpp1 = hasAspect(planets[i].name, planets[k].name, 'Opposition', aspects);
          const hasOpp2 = hasAspect(planets[j].name, planets[l].name, 'Opposition', aspects);
          const hasSquare1 = hasAspect(planets[i].name, planets[j].name, 'Square', aspects);
          const hasSquare2 = hasAspect(planets[j].name, planets[k].name, 'Square', aspects);
          const hasSquare3 = hasAspect(planets[k].name, planets[l].name, 'Square', aspects);
          const hasSquare4 = hasAspect(planets[l].name, planets[i].name, 'Square', aspects);

          if (hasOpp1 && hasOpp2 && hasSquare1 && hasSquare2 && hasSquare3 && hasSquare4) {
            const modality = getModalityFromSign(planets[i].sign);
            patterns.push({
              type: 'Grand Cross',
              planets: [planets[i].name, planets[j].name, planets[k].name, planets[l].name],
              description: `Four planets forming two oppositions and four squares in ${modality} signs`,
              modality,
              color: 'oklch(0.55 0.22 25)',
              interpretation: `The Grand Cross is one of the most challenging yet powerful patterns in astrology. This configuration in ${modality} signs creates intense internal pressure and external circumstances that demand growth. ${modality === 'Cardinal' ? 'You face constant initiation challenges and leadership tests, but possess remarkable capacity for taking action and pioneering new directions.' : modality === 'Fixed' ? 'You experience resistance to change and stubborn conflicts, but have tremendous willpower and capacity for sustained effort once direction is found.' : 'You deal with scattered energy and adaptability challenges, but possess versatility and capacity to see multiple perspectives.'} Those who master this pattern often become highly accomplished individuals who can handle any challenge.`,
            });
          }
        }
      }
    }
  }

  return patterns;
}

function detectYods(planets: Planet[], aspects: Aspect[]): AspectPattern[] {
  const patterns: AspectPattern[] = [];

  for (let i = 0; i < planets.length; i += 1) {
    for (let j = i + 1; j < planets.length; j += 1) {
      if (hasAspect(planets[i].name, planets[j].name, 'Sextile', aspects)) {
        for (let k = 0; k < planets.length; k += 1) {
          if (k !== i && k !== j) {
            const angle1 = getAngleBetweenPlanets(planets[i], planets[k]);
            const angle2 = getAngleBetweenPlanets(planets[j], planets[k]);

            const isQuincunx1 = Math.abs(angle1 - 150) <= 3;
            const isQuincunx2 = Math.abs(angle2 - 150) <= 3;

            if (isQuincunx1 && isQuincunx2) {
              const patternPlanets = [planets[i].name, planets[j].name, planets[k].name];
              const alreadyExists = patterns.some(
                (p) => p.type === 'Yod' && p.planets.slice().sort().join(',') === patternPlanets.slice().sort().join(','),
              );

              if (!alreadyExists) {
                patterns.push({
                  type: 'Yod',
                  planets: patternPlanets,
                  description: `${planets[k].name} receives quincunxes from ${planets[i].name} and ${planets[j].name} (which sextile each other)`,
                  color: 'oklch(0.75 0.18 200)',
                  interpretation: `The Yod, known as the "Finger of God," is a rare pattern indicating a special destiny or karmic mission. ${planets[k].name} is the focal point and represents an area of life that requires constant adjustment and refinement. The sextile between ${planets[i].name} and ${planets[j].name} provides supportive energy, but integrating their lessons with ${planets[k].name} requires conscious work. This pattern often indicates a unique gift or calling that must be developed over time, frequently through challenging circumstances that force growth.`,
                });
              }
            }
          }
        }
      }
    }
  }

  return patterns;
}

function detectKites(planets: Planet[], aspects: Aspect[], grandTrines: AspectPattern[]): AspectPattern[] {
  const patterns: AspectPattern[] = [];

  for (const grandTrine of grandTrines) {
    const trinePlanets = grandTrine.planets.map((name) => planets.find((p) => p.name === name)!);

    for (const planet of planets) {
      if (!grandTrine.planets.includes(planet.name)) {
        let oppositions = 0;
        let sextiles = 0;
        let opposedPlanet = '';

        for (const trinePlanet of trinePlanets) {
          if (hasAspect(planet.name, trinePlanet.name, 'Opposition', aspects)) {
            oppositions += 1;
            opposedPlanet = trinePlanet.name;
          }
          if (hasAspect(planet.name, trinePlanet.name, 'Sextile', aspects)) {
            sextiles += 1;
          }
        }

        if (oppositions === 1 && sextiles === 2) {
          patterns.push({
            type: 'Kite',
            planets: [...grandTrine.planets, planet.name],
            description: `${planet.name} opposes ${opposedPlanet} and sextiles the other Grand Trine planets`,
            element: grandTrine.element,
            color: 'oklch(0.78 0.15 85)',
            interpretation: `A Kite formation adds dynamic focus to a Grand Trine. ${planet.name} provides the motivation and drive to actualize the potential of the Grand Trine in ${grandTrine.element} signs. While the Grand Trine offers natural talents, ${planet.name} opposing ${opposedPlanet} creates necessary tension that prevents complacency and drives achievement. This pattern suggests someone who can take their innate gifts and manifest them in concrete, visible ways. You have both the talent and the drive to succeed.`,
          });
        }
      }
    }
  }

  return patterns;
}

function detectMysticRectangles(planets: Planet[], aspects: Aspect[]): AspectPattern[] {
  const patterns: AspectPattern[] = [];

  for (let i = 0; i < planets.length; i += 1) {
    for (let j = i + 1; j < planets.length; j += 1) {
      for (let k = j + 1; k < planets.length; k += 1) {
        for (let l = k + 1; l < planets.length; l += 1) {
          const hasOpp1 = hasAspect(planets[i].name, planets[k].name, 'Opposition', aspects);
          const hasOpp2 = hasAspect(planets[j].name, planets[l].name, 'Opposition', aspects);
          const hasSextile1 = hasAspect(planets[i].name, planets[j].name, 'Sextile', aspects);
          const hasSextile2 = hasAspect(planets[j].name, planets[k].name, 'Sextile', aspects);
          const hasTrine1 = hasAspect(planets[i].name, planets[l].name, 'Trine', aspects);
          const hasTrine2 = hasAspect(planets[k].name, planets[l].name, 'Trine', aspects);

          if (hasOpp1 && hasOpp2 && hasSextile1 && hasSextile2 && hasTrine1 && hasTrine2) {
            patterns.push({
              type: 'Mystic Rectangle',
              planets: [planets[i].name, planets[j].name, planets[k].name, planets[l].name],
              description: 'Four planets forming two oppositions, two sextiles, and two trines',
              color: 'oklch(0.70 0.18 180)',
              interpretation: 'The Mystic Rectangle is a harmonious and balanced pattern that combines the tension of oppositions with the flow of trines and sextiles. This configuration provides both challenge and support, creating opportunities for practical application of talents. You have the ability to balance opposing forces and use tension constructively. The trines provide natural abilities while the sextiles offer opportunities to develop skills. This pattern indicates someone who can work effectively with polarities and find creative solutions.',
            });
          }
        }
      }
    }
  }

  return patterns;
}

function detectGrandSextiles(planets: Planet[], aspects: Aspect[]): AspectPattern[] {
  const patterns: AspectPattern[] = [];

  for (let i = 0; i < planets.length; i += 1) {
    for (let j = i + 1; j < planets.length; j += 1) {
      for (let k = j + 1; k < planets.length; k += 1) {
        for (let l = k + 1; l < planets.length; l += 1) {
          for (let m = l + 1; m < planets.length; m += 1) {
            for (let n = m + 1; n < planets.length; n += 1) {
              const sextiles = [
                hasAspect(planets[i].name, planets[j].name, 'Sextile', aspects),
                hasAspect(planets[j].name, planets[k].name, 'Sextile', aspects),
                hasAspect(planets[k].name, planets[l].name, 'Sextile', aspects),
                hasAspect(planets[l].name, planets[m].name, 'Sextile', aspects),
                hasAspect(planets[m].name, planets[n].name, 'Sextile', aspects),
                hasAspect(planets[n].name, planets[i].name, 'Sextile', aspects),
              ];

              const trines = [
                hasAspect(planets[i].name, planets[k].name, 'Trine', aspects),
                hasAspect(planets[j].name, planets[l].name, 'Trine', aspects),
                hasAspect(planets[k].name, planets[m].name, 'Trine', aspects),
                hasAspect(planets[l].name, planets[n].name, 'Trine', aspects),
                hasAspect(planets[m].name, planets[i].name, 'Trine', aspects),
                hasAspect(planets[n].name, planets[j].name, 'Trine', aspects),
              ];

              if (sextiles.every((s) => s) && trines.every((t) => t)) {
                patterns.push({
                  type: 'Grand Sextile',
                  planets: [planets[i].name, planets[j].name, planets[k].name, planets[l].name, planets[m].name, planets[n].name],
                  description: 'Six planets forming a perfect hexagram with sextiles and trines',
                  color: 'oklch(0.85 0.18 120)',
                  interpretation: 'The Grand Sextile, also called the Star of David, is an extremely rare and auspicious pattern. This perfect six-pointed star indicates exceptional talents, multiple gifts, and tremendous potential. The challenge with this pattern is that so much comes easily that you may not develop discipline or push yourself to achieve. This is a gift that requires conscious effort to actualize—you have all the tools for success, but must choose to use them purposefully rather than coasting on natural abilities.',
                });
              }
            }
          }
        }
      }
    }
  }

  return patterns;
}

function detectStelliums(planets: Planet[]): AspectPattern[] {
  const patterns: AspectPattern[] = [];
  const signGroups: Record<string, string[]> = {};
  const houseGroups: Record<number, string[]> = {};

  planets.forEach((planet) => {
    if (!signGroups[planet.sign]) {
      signGroups[planet.sign] = [];
    }
    signGroups[planet.sign].push(planet.name);

    if (!houseGroups[planet.house]) {
      houseGroups[planet.house] = [];
    }
    houseGroups[planet.house].push(planet.name);
  });

  Object.entries(signGroups).forEach(([sign, planetNames]) => {
    if (planetNames.length >= 3) {
      const element = getElementFromSign(sign);
      patterns.push({
        type: 'Stellium',
        planets: planetNames,
        description: `${planetNames.length} planets concentrated in ${sign}`,
        element,
        color: 'oklch(0.80 0.15 90)',
        interpretation: `A Stellium in ${sign} creates a powerful concentration of energy in this sign. With ${planetNames.join(', ')} all here, this area of your chart is emphasized and dominant in your personality. ${element} energy is strongly represented in your nature. This concentration suggests you have strong ${sign} qualities and life experiences strongly colored by this sign's themes. The house containing this Stellium shows a major life focus and area where you invest significant energy.`,
      });
    }
  });

  Object.entries(houseGroups).forEach(([house, planetNames]) => {
    if (
      planetNames.length >= 3
      && !patterns.some((p) => p.type === 'Stellium' && p.planets.slice().sort().join(',') === planetNames.slice().sort().join(','))
    ) {
      patterns.push({
        type: 'Stellium',
        planets: planetNames,
        description: `${planetNames.length} planets in House ${house}`,
        color: 'oklch(0.80 0.15 90)',
        interpretation: `A Stellium in the ${house}${house === '1' ? 'st' : house === '2' ? 'nd' : house === '3' ? 'rd' : 'th'} house indicates this life area is of paramount importance. With ${planetNames.join(', ')} all concentrated here, much of your life energy and experiences revolve around ${house}th house themes. This house represents a major focus of your incarnation and area where you'll develop expertise and face significant experiences.`,
      });
    }
  });

  return patterns;
}

export function detectAspectPatterns(planets: Planet[], aspects: Aspect[]): AspectPattern[] {
  const patterns: AspectPattern[] = [];

  const grandTrines = detectGrandTrines(planets, aspects);
  patterns.push(...grandTrines);
  patterns.push(...detectTSquares(planets, aspects));
  patterns.push(...detectGrandCrosses(planets, aspects));
  patterns.push(...detectYods(planets, aspects));
  patterns.push(...detectKites(planets, aspects, grandTrines));
  patterns.push(...detectMysticRectangles(planets, aspects));
  patterns.push(...detectGrandSextiles(planets, aspects));
  patterns.push(...detectStelliums(planets));

  return patterns;
}
