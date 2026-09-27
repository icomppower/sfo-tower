# Rules implemented (FAA Order JO 7110.65BB)

Quoted from the FAA HTML edition cached in `data/raw/faa-7110/` (checksums in `data/checksums.json`). Each block ends with how the sim uses it. Wake categories are the Consolidated Wake Turbulence (CWT) letters A–I assigned per type by JO 7360.1K / the FAA Aircraft Characteristics Database.

## 2-1-19

> 2-1-19. WAKE TURBULENCE
> Apply wake turbulence procedures to an aircraft operating behind another aircraft when wake turbulence separation is required.
> NOTE-
> Paragraph 5-5-4, Minima, subparagraphs f and g specify the required radar wake turbulence separations. Time-based separations are contained in paragraph 3-9-6, Same Runway Separation, paragraph 3-9-7, Wake Turbulence Separation for Intersection Departures, paragraph 3-9-8, Intersecting Runway Separation, paragraph 3-9-9, Nonintersecting Converging Runway Operations, paragraph 3-10-3, Same Runway Separation, paragraph 3-10-4, Intersecting Runway Separation, paragraph 6-1-4, Adjacent Airport Operation, paragraph 6-1-5, Arrival Minima, and paragraph 6-7-5, Interval Minima.
> The separation minima must continue to touchdown for all IFR aircraft not making a visual approach or maintaining visual separation.
> REFERENCE-
> FAA Order JO 7110.65, Para 5-9-5, Approach Separation Responsibility.

**Sim:** sim/rules.js applies wake separation to touchdown for IFR arrivals not on a visual approach.

## 3-9-4

> 3-9-4. LINE UP AND WAIT (LUAW)
> The intent of LUAW is to position aircraft for an imminent departure. Authorize an aircraft to line up and wait, except as restricted in subparagraph g, when takeoff clearances cannot be issued because of traffic. Issue traffic information to any aircraft so authorized. Traffic information may be omitted when the traffic is another aircraft which has landed on or is taking off the runway and is clearly visible to the holding aircraft. Do not use conditional phrases such as “behind landing traffic” or “after the departing aircraft.”
> First state the runway number followed by the line up and wait clearance.
> PHRASEOLOGY-
> RUNWAY (number), LINE UP AND WAIT.
> NOTE-
> When using LUAW, an imminent departure is one that will not be delayed beyond the time that is required to ensure a safe operation. An aircraft should not be in LUAW status for more than 90 seconds without additional instructions.
> Procedures.
> At facilities without a safety logic system or facilities with the safety logic system in limited configuration:
> Do not clear an aircraft for a full‐stop, touch‐and‐go, stop‐and‐go, low approach, or option on the same runway with an aircraft holding in position or taxiing to LUAW until the aircraft in position has exited the runway or starts takeoff roll.
> PHRASEOLOGY-
> RUNWAY (number), CONTINUE, TRAFFIC HOLDING IN POSITION, 
> or 
> RUNWAY (number) (pattern instructions as appropriate) TRAFFIC HOLDING IN POSITION.
> EXAMPLE-
> “American 528, Runway Two-Three continue, traffic holding in position.”
> “Twin Cessna Four Four Golf, Runway One-Niner Right, base approved, traffic holding in position."
> “Baron Two Five Foxtrot, Runway One-Niner, extend downwind, tower will call your base, traffic holding in position."
> REFERENCE-
> FAA Order JO 7110.65, Para 3-10-10, Altitude Restricted Low Approach.
> Do not authorize an aircraft to LUAW if an aircraft has been cleared for a full‐stop, touch‐and‐go, stop‐and‐go, low approach, or option on the same runway.
> Except when reported weather conditions are less than ceiling 800 feet or visibility less than 2 miles, facilities using the safety logic system in the full core alert mode:
> May issue clearance for a full‐stop, touch‐and‐go, stop‐and‐go, low approach, or option on the same runway with an aircraft holding in position or taxiing to LUAW, or
> May authorize an aircraft to LUAW when an aircraft has been cleared for a full‐stop, touch‐and‐go, stop‐and‐go, low approach, or option on the same runway.
> REFERENCE-
> FAA Order JO 7110.65, Para 3-10-5, Landing Clearance.
> When an aircraft is authorized to LUAW, inform it of the closest traffic within 6 flying miles requesting a full‐stop, touch‐and‐go, stop‐and‐go, low approach, or option to the same runway.
> EXAMPLE-
> “United Five, Runway One Eight, line up and wait. Traffic a Boeing Seven Thirty Seven, six mile final.
> Do not authorize an aircraft to line up and wait when the departure point is not visible from the tower, unless the aircraft's position can be verified by ASDE or the runway is used for departures only.
> An aircraft may be authorized to line up and wait at an intersection between sunset and sunrise under the following conditions:
> The procedure must be approved by the appropriate Service Area Director of Air Traffic Operations.
> The procedure must be contained in a facility directive.
> The runway must be used as a departure-only runway.
> Only one aircraft at a time is permitted to line up and wait on the same runway.
> Document on FAA Form 7230-4, Daily Record of Facility Operation, the following: “LUAW at INT of RWY (number) and TWY (name) IN EFFECT” when using runway as a departure-only runway. “LUAW at INT of RWY (number) and TWY (name) SUSPENDED” when runway is not used as a departure-only runway.
> Do not authorize an aircraft to line up and wait at anytime when the intersection is not visible from the tower.
> Do not authorize aircraft to simultaneously line up and wait on the same runway, between sunrise and sunset, unless the local assist/local monitor position is staffed.
> USN. Do not authorize aircraft to line up and wait simultaneously on intersecting runways.
> PHRASEOLOGY-
> CONTINUE HOLDING,
>  or
> TAXI OFF THE RUNWAY.
> REFERENCE-
> FAA Order JO 7110.65, Para 3-10-10, Altitude Restricted Low Approach.
> When aircraft are authorized to line up and wait on runways that intersect, traffic must be exchanged between that aircraft and the aircraft that is authorized to line up and wait, depart, or arrive to the intersecting runway(s).
> EXAMPLE-
> “United Five, Runway Four, line up and wait, traffic holding Runway Three-One.”
> “Delta One, Runway Three-One, line up and wait, traffic holding Runway Four.”
> Or, when issuing traffic information to an arrival aircraft and an aircraft that is holding on runway(s) that intersect(s):
> “Delta One, Runway Four, line up and wait, traffic landing Runway Three-One.”
> “United Five, Runway Three-One, cleared to land. Traffic holding in position Runway Four.”
> Or, when issuing traffic information to a departing aircraft and an aircraft that is holding on runway(s) that intersect(s):
> “Delta One, Runway Three-One, line up and wait, traffic departing Runway Four.”
> “United Five, Runway Four, cleared for takeoff, traffic holding in position Runway Three-One.”
> REFERENCE-
> FAA Order JO 7110.65, Para 3-9-8, Intersecting Runway/Intersecting Flight Path Operations.
> FAA Order JO 7110.65, Para 3-10-4, Intersecting Runway/Intersecting Flight Path Separation.
> When a local controller delivers or amends an ATC clearance to an aircraft awaiting departure and that aircraft is holding short of a runway or is holding in position on a runway, an additional clearance must be issued to prevent the possibility of the aircraft inadvertently taxiing onto the runway and/or beginning takeoff roll. In such cases, append one of the following ATC instructions as appropriate:
> HOLD SHORT OF RUNWAY, or
> HOLD IN POSITION.
> USAF/USN. When issuing additional instructions or information to an aircraft holding in position, include instructions to continue holding or taxi off the runway, unless it is cleared for takeoff.
> PHRASEOLOGY-
> CONTINUE HOLDING,
>  or
> TAXI OFF THE RUNWAY.
> REFERENCE-
> FAA Order JO 7110.65, Para 3-10-10, Altitude Restricted Low Approach.
> When authorizing an aircraft to line up and wait at an intersection, state the runway intersection.
> PHRASEOLOGY-
> RUNWAY (number) AT (taxiway designator), LINE UP AND WAIT.
> When two or more aircraft call the tower ready for departure, one or more at the full length of a runway and one or more at an intersection, state the location of the aircraft at the full length of the runway when authorizing that aircraft to line up and wait.
> PHRASEOLOGY-
> RUNWAY (number), FULL-LENGTH, LINE UP AND WAIT.
> EXAMPLE-
> “American Four Eighty Two, Runway Three-Zero full length, line up and wait.”
> NOTE-
> The controller need not state the location of the aircraft departing the full length of the runway if there are no aircraft holding for departure at an intersection for that same runway.
> Do not use the term “full length” when the runway length available for departure has been temporarily shortened. On permanently shortened runways, do not use the term “full length” until the Chart Supplement is updated to include the change(s).
> NOTE-
> The use of the term “full length” could be interpreted by the pilot(s) as the available runway length prior to the runway being shortened.
> Whenever a runway length has been temporarily or permanently shortened, state the word “shortened” immediately following the runway number as part of the line up and wait clearance.
> The addition of “shortened” must be included in the line up and wait clearance for the duration of the construction project when the runway is temporarily shortened.
> The addition of “shortened” must be included in the line up and wait clearance until the Chart Supplement is updated to include the change(s) when the runway is permanently shortened.
> PHRASEOLOGY-
> RUNWAY (number) SHORTENED, LINE UP AND WAIT.
> EXAMPLE-
> “Runway Two-Seven shortened, line up and wait.”
> REFERENCE-
> FAA Order JO 7210.3, Para 10-3-12, Airport Construction.
> FAA Order JO 7210.3, Para 10-3-13, Change in Runway Length Due to Construction.

**Sim:** LUAW command: an aircraft may line up and wait; takeoff clearance is a separate action.

## 3-9-6

> 3-9-6. SAME RUNWAY SEPARATION
> Separate a departing aircraft from a preceding departing or arriving aircraft using the same runway by ensuring that it does not begin takeoff roll until:
> The other aircraft has departed and crossed the runway end or turned to avert any conflict. (See FIG 3-9-1.) If you can determine distances by reference to suitable landmarks, the other aircraft needs only be airborne if the following minimum distance exists between aircraft: (See FIG 3-9-2.)
> When only Category I aircraft are involved- 3,000 feet.
> When a Category I aircraft is preceded by a Category II aircraft- 3,000 feet.
> When either the succeeding or both are Category II aircraft- 4,500 feet.
> When either is a Category III aircraft- 6,000 feet.
> When the succeeding aircraft is a helicopter or powered‐lift aircraft, visual separation may be applied in lieu of using distance minima.
> FIG 3-9-1Same Runway Separation
> FIG 3-9-2Same Runway Separation
> NOTE-
> Aircraft same runway separation (SRS) categories are specified in FAA Order JO 7360.1, Aircraft Type Designators and based upon the following definitions:
> CATEGORY I− small single-engine propeller driven aircraft weighing 12,500 lbs. or less, and all helicopters. 
> CATEGORY II− small twin-engine propeller driven aircraft weighing 12,500 lbs. or less.
> CATEGORY III− all other aircraft.
> A preceding landing aircraft is clear of the runway. (See FIG 3-9-3.)
> FIG 3-9-3Preceding Landing Aircraft Clear of Runway
> REFERENCE-
> P/CG Term- Clear of the Runway.
> WAKE TURBULENCE APPLICATION
>  | 
> Do not issue clearances which imply or indicate approval of rolling takeoffs by super or heavy aircraft except as provided in paragraph 3-1-14, Ground Operations When Volcanic Ash is Present.
> Do not issue clearances to a small aircraft to line up and wait on the same runway behind a departing super or heavy aircraft to apply the necessary intervals. 
> REFERENCE-
> AC 90-23, Aircraft Wake Turbulence.
> The minima in paragraph 5-5-4, Minima, subparagraph g and TBL 5-5-1, may be applied in lieu of the time interval requirements in subparagraphs f, g, and h. When paragraph 5-5-4, TBL 5-5-1, is applied, ensure that the appropriate radar separation exists at or prior to the time an aircraft becomes airborne.
> REFERENCE-
> FAA Order JO 7210.3, Para 2–1–16, Authorization for Separation Services by Towers. 
> FAA Order JO 7210.3, Para 10–5–3, Functional Use of Certified Tower Radar Displays.
> NOTE-
> The pilot may request additional separation, but should make this request before taxiing on the runway.
> Takeoff clearance to the following aircraft should not be issued until the time interval has passed after the preceding aircraft begins takeoff roll.
> Separate aircraft taking off from the same runway or a parallel runway separated by less than 2,500 feet (see FIG 3-9-4):
> Category B, C, D, E, F, G, H, or I aircraft behind Category A aircraft – 3 minutes.
> Category B, C, D, E, F, G, H, or I aircraft behind Category B or D aircraft – 2 minutes.
> Category E, F, G, H, or I aircraft behind Category C aircraft – 2 minutes.
> FIG 3-9-4Same Runway Separation
> Separate a Category I aircraft behind a Category E aircraft by 2 minutes when departing:
> The same runway or a parallel runway separated by less than 700 feet. (See FIG 3-9-5 and FIG 3-9-6.)
> FIG 3-9-5Same Runway Separation
> FIG 3-9-6Parallel Runway Separated by Less than 700 Feet
> A parallel runway separated by 700 feet or more if projected flight paths will cross. (See FIG 3-9-7).
> FIG 3-9-7Parallel Runway Separated by 700 Feet or More
> Separate aircraft departing from a parallel runway separated by 2,500 feet or more if projected flight paths will cross (See FIG 3-9-8):
> Category B, C, D, E, F, G, H, or I aircraft behind Category A aircraft – 3 minutes.
> Category B, C, D, E, F, G, H, or I aircraft behind Category B or D aircraft – 2 minutes.
> Category E, F, G, H, or I aircraft behind Category C aircraft – 2 minutes.
> FIG 3-9-8Parallel Runways Separated by 2,500 feet or More
> Separate aircraft when operating on a runway with a displaced landing threshold if projected flight paths will cross when either a departure follows an arrival or an arrival follows a departure by the following minima:
> Category B, C, D, E, F, G, H, or I aircraft behind Category A aircraft – 3 minutes.
> Category B, C, D, E, F, G, H, or I aircraft behind Category B or D aircraft – 2 minutes.
> Category E, F, G, H, or I aircraft behind Category C aircraft – 2 minutes.
> Category I aircraft behind Category E aircraft – 2 minutes.
> Separate an aircraft behind another aircraft that has departed or made a low/missed approach when utilizing opposite direction takeoffs or landings on the same or parallel runways separated by less than 2,500 feet by the following minima: 
> Category B, C, D, E, F, G, H, or I aircraft behind Category A aircraft – 4 minutes.
> Category B, C, D, E, F, G, H, or I aircraft behind Category B or D aircraft – 3 minutes.
> Category E, F, G, H, or I aircraft behind Category C aircraft – 3 minutes.
> Separate a Category I aircraft behind a Category E aircraft that has departed or made a low/missed approach by 3 minutes when utilizing opposite direction takeoffs or landings from:
> The same runway or a parallel runway separated by less than 700 feet.
> A parallel runway separated by 700 feet or more if projected flight paths will cross.
> Do not approve pilot requests to deviate from the required intervals contained in subparagraphs f through k.
> PHRASEOLOGY-
> HOLD FOR WAKE TURBULENCE.
> REFERENCE-
> FAA Order JO 7110.65, Para 3-9-7, Wake Turbulence Separation for Intersection Departures.
> Separate a Category I aircraft behind a Category F or G aircraft that has departed or made a low/missed approach when utilizing opposite direction takeoffs on the same runway by 3 minutes unless a pilot has initiated a request to deviate from the time interval. In the latter case, issue a wake turbulence cautionary advisory before clearing the aircraft for takeoff. Controllers must not initiate or suggest a waiver of the time interval.
> NOTE-
> A request for takeoff does not initiate a waiver request.
> Inform aircraft when it is necessary to hold in order to provide the required time interval.

**Sim:** Same-runway departure separation: preceding departure past the runway end / airborne with the SRS distance, or preceding arrival clear of the runway; CWT time intervals (3 min behind A, 2 min behind B/D, 2 min E-I behind C, 2 min I behind E).

## 3-9-8

> 3-9-8. INTERSECTING RUNWAY/INTERSECTING FLIGHT PATH OPERATIONS
> Issue traffic information to each aircraft operating on intersecting runways.
> Separate departing aircraft from another aircraft using an intersecting runway by ensuring that the departure does not begin takeoff roll until one of the following exists:
> REFERENCE-
> FAA Order JO 7110.65, Para 2-1-21, Traffic Advisories.
> The preceding aircraft has departed and passed the intersection or is turning to avert any conflict. (See FIG 3-9-9).
> FIG 3-9-9Intersecting Runway Separation
> A preceding arriving aircraft (See FIG 3-9-10).
> Is clear of the landing runway, or
> Has completed landing roll and acknowledged the instruction to hold short of the intersection, or
> Has completed landing roll and acknowledged the instruction to exit the runway prior to intersection, or
> Has completed landing roll and is observed turning at an exit point prior to the intersection, or
> Has passed the intersection.
> REFERENCE-
> P/CG Term- Clear of the Runway.
> P/CG Term – Landing Roll.
> FIG 3-9-10Intersecting Runway Separation
> USA/USAF/USN NOT APPLICABLE. An arriving aircraft has acknowledged a clearance to land and hold short of the intersecting runway/intersecting flight path being used by a departing aircraft in accordance with FAA Order JO 7110.118, Land and Hold Short Operations (LAHSO). (See FIG 3-9-11.)
> REFERENCE-
> FAA Order JO 7110.65, Para 3-10-4, Intersecting Runway/Intersecting Flight Path Separation.
> FIG 3-9-11Intersecting Runway Separation
> WAKE TURBULENCE APPLICATION
>  | 
> Separate aircraft taking off behind a departing or landing aircraft on an intersecting runway if flight paths will cross (see FIG 3-9-12 and FIG 3-9-13):
> NOTE-
> Takeoff clearance to the following aircraft should not be issued until the appropriate time interval has passed after the preceding aircraft began takeoff roll.
> Category B, C, D, E, F, G, H, or I aircraft behind Category A aircraft – 3 minutes.
> Category B, C, D, E, F, G, H, or I aircraft behind Category B or D aircraft – 2 minutes.
> Category E, F, G, H, or I aircraft behind Category C aircraft – 2 minutes.
> Category I aircraft behind Category E aircraft – 2 minutes.
> FIG 3-9-12Departure Behind Departure on Intersecting Runway
> FIG 3-9-13Departure Behind Arrival on Intersecting Runway
> Pilot requests to deviate from the required time intervals must not be approved if the preceding aircraft requires wake turbulence separation.
> REFERENCE-
> FAA Order JO 7110.65, Para 5-5-4, Minima, Subpara g.

**Sim:** Intersecting-runway departure separation (SFO 1L/1R departures vs 28L/28R arrivals): no takeoff roll until the arrival has passed the intersection, is clear, or holds short; CWT time intervals when flight paths cross.

## 3-10-3

> 3-10-3. SAME RUNWAY SEPARATION
> Separate an arriving aircraft from another aircraft using the same runway by ensuring that the arriving aircraft does not cross the landing threshold until one of the following conditions exists or unless authorized in paragraph 3-10-10, Altitude Restricted Low Approach.
> The other aircraft has landed and is clear of the runway. (See FIG 3-10-1.) Between sunrise and sunset, if you can determine distances by reference to suitable landmarks and the other aircraft has landed, it need not be clear of the runway if the following minimum distance from the landing threshold exists:
> REFERENCE-
> P/CG Term - Clear of the Runway.
> FIG 3-10-1Same Runway Separation
> When a Category I aircraft is landing behind a Category I or II- 3,000 feet.
> (See FIG 3-10-2.)
> FIG 3-10-2Same Runway Separation
> When a Category II aircraft is landing behind a Category I or II- 4,500 feet.
> (See FIG 3-10-3.)
> FIG 3-10-3Same Runway Separation
> The other aircraft has departed and crossed the runway end. (See FIG 3-10-4). If you can determine distances by reference to suitable landmarks and the other aircraft is airborne, it need not have crossed the runway end if the following minimum distance from the landing threshold exists:
> Category I aircraft landing behind Category I or II- 3,000 feet.
> Category II aircraft landing behind Category I or II- 4,500 feet.
> When either is a category III aircraft- 6,000 feet. (See FIG 3-10-5.)
> FIG 3-10-4Same Runway Separation
> FIG 3-10-5Same Runway Separation
> When the succeeding aircraft is a helicopter or powered‐lift aircraft, visual separation may be applied in lieu of using distance minima.
> WAKE TURBULENCE APPLICATION
>  | 
> Issue wake turbulence advisories, and the position, altitude if known, and the direction of flight of departing or arriving aircraft on the same runway or parallel runways separated by less than 2,500 feet to:
> Category B, C, D, E, F, G, H, and I aircraft behind Category A, B, or D aircraft.
> Category E, F, G, H, or I aircraft behind Category C aircraft.
> Category I aircraft behind Category E aircraft.
> REFERENCE-
> AC 90-23, Aircraft Wake Turbulence, Para 11, Pilot Responsibility.
> FAA Order JO 7110.65, Para 3-10-10, Altitude Restricted Low Approach.
> EXAMPLE-
> “Runway two seven left cleared to land, caution wake turbulence, heavy Boeing 747 departing runway two seven right.”
> “Number two follow Boeing 757 on 2‐mile final. Caution wake turbulence.”
> “Traffic, heavy Boeing 787 on 2‐mile final to the parallel runway, runway two six right, cleared to land. Caution wake turbulence.”

**Sim:** Same-runway arrival separation: threshold crossing only when the runway is clear or the SRS distance exists (3,000 / 4,500 / 6,000 ft).

## 3-10-4

> 3-10-4. INTERSECTING RUNWAY/INTERSECTING FLIGHT PATH OPERATIONS
> Issue traffic information to each aircraft operating on intersecting runways.
> Separate an arriving aircraft using one runway from another aircraft using an intersecting runway or a nonintersecting runway when the flight paths intersect by ensuring that the arriving aircraft does not cross the landing threshold or flight path of the other aircraft until one of the following conditions exists:
> REFERENCE-
> FAA Order JO 7110.65, Para 2-1-21, Traffic Advisories.
> INTERPRETATION-
> 7110.65, 3-10-4, Intersecting Runway/Intersecting Flight Path Separation and 5-5-4, Minima (2021-06-09)
> The preceding aircraft has departed and passed the intersection/flight path or is airborne and turning to avert any conflict. (See FIG 3-10-6 and FIG 3-10-7.)
> FIG 3-10-6Intersecting Runway Separation
> FIG 3-10-7Intersecting Runway Separation
> A preceding arriving aircraft is clear of the landing runway, completed landing roll and will hold short of the intersection/flight path, or has passed the intersection/flight path. (See FIG 3-10-8 and FIG 3-10-9.)
> FIG 3-10-8Intersection Runway Separation
> FIG 3-10-9Intersection Runway Separation
> NOTE-
> When visual separation is being applied by the tower, appropriate control instructions and traffic advisories must be issued to ensure go around or missed approaches avert any conflict with the flight path of traffic on the other runway.
> REFERENCE-
> FAA Order JO 7110.65, Para 7-2-1, Visual Separation, Subpara a2.
> USA/USAF/USN NOT APPLICABLE. An arriving aircraft may be authorized to land and hold short of the intersecting runway/intersecting flight path being used by another departing or arriving aircraft in accordance with FAA Order JO 7110.118, Land and Hold Short Operations (LAHSO). The following procedures apply:
> NOTE-
> Application of these procedures does not relieve controllers from the responsibility of providing other appropriate separation contained in this order.
> Instruct the arriving aircraft to land and hold short of the intersecting runway/intersecting flight path. In the case of simultaneous landings and no operational benefit is lost, restrict the aircraft of the lesser weight category (if known). (See FIG 3-10-10 and FIG 3-10-11.)
> NOTE-
> The hold short point issued to an arriving aircraft may or may not be the intersecting runway or approach/departure flight path of the other runway. The hold short point may be a taxiway or other predetermined point on the runway that protects the intersecting runway/intersecting flight path.
> REFERENCE-
> FAA Order JO 7110.65, Para 3-10-5, Landing Clearance.
> FIG 3-10-10Intersecting Runway Separation
> Issue traffic information to both aircraft involved and obtain an acknowledgment from each.
> EXAMPLE-
> “Runway one eight cleared to land, hold short of runway one four left, traffic, (type aircraft) landing runway one four left.”
> “Runway one four left cleared to land, traffic, (type aircraft) landing runway one eight will hold short of the intersection.”
> “Runway three six cleared to land, hold short of runway three three, traffic, (type aircraft) departing runway three three.”
> “Traffic, (type aircraft) landing runway three six will hold short of the intersection, runway three three cleared for takeoff.”
> The conditions in subparagraphs b1 and b2 above must be met in sufficient time to take other action, if desired by the pilot(s), and no later than the time landing clearance is issued.
> WAKE TURBULENCE APPLICATION
>  | 
> Separate aircraft landing behind a departing aircraft on a crossing runway if the arrival will fly through the airborne path of the departure by the appropriate radar separation or the following intervals: (See FIG 3-10-11):
> Category B, C, D, E, F, G, H, or I aircraft behind Category A aircraft – 3 minutes.
> Category B, C, D, E, F, G, H, or I aircraft behind Category B or D aircraft – 2 minutes.
> Category E, F, G, H, or I aircraft behind Category C aircraft – 2 minutes.
> Category I aircraft behind Category E aircraft – 2 minutes.
> Issue wake turbulence cautionary advisories, the position, altitude if known, and direction of flight of Category A, B, C, D, or E aircraft to:
> REFERENCE-
> AC 90-23, Aircraft Wake Turbulence, Para 11, Pilot Responsibility.
> FIG 3-10-11Intersecting Runway Separation
> All aircraft landing on a crossing runway behind a departing aircraft that requires wake turbulence separation behind it if the arrival flight path will cross the takeoff path behind the departing aircraft rotation point. (See FIG 3-10-12.)
> FIG 3-10-12Intersecting Runway Separation
> EXAMPLE-
> “Runway niner cleared to land. Caution wake turbulence, heavy C-Seventeen departing runway one five.”
> All VFR aircraft landing on a crossing runway behind an arriving Category A, B, C, or D aircraft and VFR Category I aircraft landing on a crossing runway behind a Category E aircraft, if the arrival flight paths will cross. (See FIG 3-10-13.)
> FIG 3-10-13Intersecting Runway Separation
> EXAMPLE-
> “Runway niner cleared to land. Caution wake turbulence, Boeing Seven Fifty Seven landing runway three six.”
> REFERENCE-
> FAA Order JO 7110.65, Para 7-4-4, Approaches to Multiple Runways.

**Sim:** Intersecting-runway arrival separation: an arrival may not cross the threshold until the departing aircraft has passed the intersection or is airborne and turning away.

## 5-5-4

> 5-5-4. MINIMA
> Separate aircraft by the following minima:
> TERMINAL. Single Sensor ASR or Digital Terminal Automation System (DTAS):
> NOTE-
> Includes single sensor long range radar mode.
> ADS-B and WAM are not selectable sources when in Single Sensor Mode.
> When less than 40 miles from the antenna- 3 miles.
> When 40 miles or more from the antenna- 5 miles.
> For single sensor monopulse secondary surveillance radar (MSSR), when less than 60 miles from the antenna- 3 miles.
> If TRK appears in the data block, handle in accordance with paragraph 5-3-7, Identification Status, subparagraph b, and take appropriate steps to establish nonradar separation.
> NOTE-
> TRK appears in the data block whenever the aircraft is being tracked by a radar site other than the radar currently selected. Current equipment limitations preclude a target from being displayed in the single sensor mode; however, a position symbol and data block, including altitude information, will still be displayed. Therefore, low altitude alerts must be provided in accordance with paragraph 2-1-6, Safety Alert.
> TERMINAL. FUSION:
> Fusion target symbol – 3 miles.
> When displaying ISR in the data block- 5 miles.NOTE-
> In the event of an unexpected ISR on one or more aircraft, the ATCS working that aircraft must transition from 3‐mile to 5‐mile separation, or establish some other form of approved separation as soon as feasible. This action must be timely, but taken in a reasonable fashion, using the controller's best judgment, as not to reduce safety or the integrity of the traffic situation. For example, if ISR appears when an aircraft is established on final with another aircraft on short final, it would be beneficial from a safety perspective to allow the trailing aircraft to continue the approach and land rather than terminate a stabilized approach.
> If TRK appears in the data block, handle in accordance with paragraph 5-3-7, Identification Status, subparagraph b, and take appropriate steps to establish nonradar separation.
> The ADS-B Computer Human Interface (CHI) may be implemented by facilities on a sector by sector or facility wide basis when the determination is made that utilization of the ADS-B CHI provides an operational advantage to the controller.
> STARS Multi-Sensor Mode – 5 miles.
> NOTE-
> STARS Multi-Sensor Mode displays target symbols derived from radar, ADS-B, and WAM.
> ERAM:
> Below FL 600- 5 miles.
> At or above FL 600- 10 miles.
> Up to and including FL 230 where all the following conditions are met – 3 miles:
> Within the 3 NM separation area, and:
> Within 40 NM of the preferred radar; or
> Within 60 NM of the preferred radar when using an MSSR; or
> When operating in track-based display mode.
> The preferred sensor and/or ADS-B is providing reliable targets.
> Facility directives specifically define the 3 NM separation area.
> The 3 NM separation area is displayable on the video map.
> Involved aircraft are displayed using the 3 NM target symbol.
> NOTE-
> ADS-B allows the expanded use of 3 NM separation in approved areas. It is not required for and does not affect the use of radar for 3 NM separation.
> When transitioning from terminal to en route control, 3 miles increasing to 5 miles or greater, provided:
> The aircraft are on diverging routes/courses, and/or
> The leading aircraft is and will remain faster than the following aircraft; and
> Separation constantly increasing and the first center controller will establish 5 NM or other appropriate form of separation prior to the aircraft departing the first center sector; and
> The procedure is covered by a letter of agreement between the facilities involved and limited to specified routes and/or sectors/positions.
> REFERENCE-
> FAA Order JO 7210.3, Para 8-2-1, Three Mile Airspace Operations.
> MEARTS Mosaic Mode:
> Below FL 600- 5 miles.
> At or above FL 600- 10 miles.
> For areas meeting all of the following conditions – 3 miles:
> Radar site adaptation is set to single sensor mode.
> NOTE-
> Single Sensor Mode displays information from the radar input of a single site.
> Procedures to convert MEARTS Mosaic Mode to MEARTS Single Sensor Mode at each PVD/MDM will be established by facility directive.
> Significant operational advantages can be obtained.
> Within 40 NM of the sensor or within 60 NM of the sensor when using an MSSR and within the 3 NM separation area.
> Up to and including FL230.
> Facility directives specifically define the area where the separation can be applied and definethe requirements for displaying the area on the controller's PVD/MDM.
> MEARTS Mosaic Mode Utilizing Single Source Polygon (San Juan CCF and Honolulu Control Facility only) when meeting all of the following conditions – 3 miles:
> Up to and including FL230 within 40 miles from the antenna or within 60 NM when using an MSSR and targets are from the adapted sensor.
> The single source polygon must be displayed on the controller's PVD/MDM.
> Significant operational advantages can be obtained.
> Facility directives specifically define the single source polygon area where the separation can be applied and specify procedures to be used.
> Controller must commence a transition to achieve either vertical separation or 5 mile lateral separation in the event that either target is not from the adapted sensor.
> WAKE TURBULENCE APPLICATION
>  | 
> NOTE-
> Wake turbulence procedures specify increased separation minima required for certain categories of aircraft because of the possible effects of wake turbulence.
> EN ROUTE. Provide wake turbulence separation as follows:
> Separate aircraft operating directly behind, following an aircraft conducting an instrument approach and/or operating within 2,500 feet and less than 1,000 feet below, by the following:
> Behind super - 5 miles, unless the super is operating at or below FL240 and below 250 knots, then:
> Heavy - 6 miles.
> Large - 7 miles.
> Small - 8 miles.
> Behind heavy:
> Heavy - 4 miles.
> Large or small - 5 miles.
> Separate a small aircraft behind a B757 – 4 miles when operating directly behind, following a B757 conducting an instrument approach and/or operating within 2,500 feet and less than 500 feet below.
> Separate an aircraft landing behind another aircraft on the same runway, or one making a touch‐and‐go, stop‐and‐go, or low approach by ensuring the minima below will exist at the time the preceding aircraft is over the landing threshold. If the landing threshold cannot be determined, the minima should be applied as constant or increasing at the closest point that can be determined prior to the landing threshold.
> Small behind large - 4 miles.
> Small behind heavy - 6 miles.
> NOTE-
> Consider parallel runways less than 2,500 feet apart as a single runway because of the possible effects of wake turbulence.
> WAKE TURBULENCE APPLICATION
>  | 
> TERMINAL. Separate aircraft by the minima specified in TBL 5-5-1 in accordance with the following:
> When following an aircraft conducting an instrument approach and/or operating within 2,500 feet and less than 1,000 feet below the flight path of a Category A, B, C, or D aircraft.
> When following an aircraft conducting an instrument approach and/or operating within 2,500 feet and/or less than 500 feet below a Category E aircraft.
> When departing parallel runways separated by less than 2,500 feet, the 2,500 feet requirement in subparagraph 2 is not required when a Category I aircraft departs the parallel runway behind a Category E aircraft. Issue a wake turbulence cautionary advisory and instructions that will establish lateral separation in accordance with subparagraph 2. Do not issue instructions that will allow the Category I aircraft to pass behind the Category E aircraft.
> NOTE-
> The application of paragraph 5-8-3, Successive or Simultaneous Departures, satisfies this requirement.
> Consider runways separated by less than 700 feet as a single runway because of the possible effects of wake turbulence.
> REFERENCE-
> FAA Order JO 7110.65, Para 3-9-6, Same Runway Separation.
> TBL 5-5-3Wake Turbulence Separation for Directly Behind
>  | 
> FOLLOWER
>  | 
> A
>  | 
> B
>  | 
> C
>  | 
> D
>  | 
> E
>  | 
> F
>  | 
> G
>  | 
> H
>  | 
> I
>  | 
>  | 
> A
>  | 
>  | 
> 5 NM
>  | 
> 6 NM
>  | 
> 6 NM
>  | 
> 7 NM
>  | 
> 7 NM
>  | 
> 7 NM
>  | 
> 8 NM
>  | 
> 8 NM
>  | 
> B
>  | 
>  | 
> 3 NM
>  | 
> 4 NM
>  | 
> 4 NM
>  | 
> 5 NM
>  | 
> 5 NM
>  | 
> 5 NM
>  | 
> 5 NM
>  | 
> 5 NM
>  | 
> C
>  | 
>  | 
>  | 
>  | 
>  | 
> 3.5 NM
>  | 
> 3.5 NM
>  | 
> 3.5 NM
>  | 
> 5 NM
>  | 
> 5 NM
>  | 
> D
>  | 
>  | 
> 3 NM
>  | 
> 4 NM
>  | 
> 4 NM
>  | 
> 5 NM
>  | 
> 5 NM
>  | 
> 5 NM
>  | 
> 5 NM
>  | 
> 5 NM
>  | 
> E
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
> 4 NM
>  | 
> F
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
> G
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
> H
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
> I
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
> TERMINAL. ON APPROACH. In addition to subparagraph g, separate an aircraft on approach behind another aircraft to the same runway by ensuring the separation minima in TBL 5-5-2 will exist at the time the preceding aircraft is over the landing threshold.
> NOTE-
> Consider parallel runways less than 2,500 feet apart as a single runway because of the possible effects of wake turbulence.
> TBL 5-5-4Wake Turbulence Separation for On Approach
>  | 
> FOLLOWER
>  | 
> A
>  | 
> B
>  | 
> C
>  | 
> D
>  | 
> E
>  | 
> F
>  | 
> G
>  | 
> H
>  | 
> I
>  | 
>  | 
> A
>  | 
>  | 
> 5 NM
>  | 
> 6 NM
>  | 
> 6 NM
>  | 
> 7 NM
>  | 
> 7 NM
>  | 
> 7 NM
>  | 
> 8 NM
>  | 
> 8 NM
>  | 
> B
>  | 
>  | 
> 3 NM
>  | 
> 4 NM
>  | 
> 4 NM
>  | 
> 5 NM
>  | 
> 5 NM
>  | 
> 5 NM
>  | 
> 5 NM
>  | 
> 6 NM
>  | 
> C
>  | 
>  | 
>  | 
>  | 
>  | 
> 3.5 NM
>  | 
> 3.5 NM
>  | 
> 3.5 NM
>  | 
> 5 NM
>  | 
> 6 NM
>  | 
> D
>  | 
>  | 
> 3 NM
>  | 
> 4 NM
>  | 
> 4 NM
>  | 
> 5 NM
>  | 
> 5 NM
>  | 
> 5 NM
>  | 
> 6 NM
>  | 
> 6 NM
>  | 
> E
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
> 4 NM
>  | 
> F
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
> 4 NM
>  | 
> G
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
> H
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
> I
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
>  | 
> TERMINAL. When NOWGT is displayed in an aircraft data block, provide 10 miles separation behind the preceding aircraft and 10 miles separation to the succeeding aircraft.
> INTERPRETATION-
> 7110.65, 5-5-4, Minima, Wake Turbulence Minima Application (2-23-2023)
> 7110.65, 5-5-4h, Minima (2-21-2023)
> TERMINAL. 2.5 nautical miles (NM) separation is authorized between aircraft established on the final approach course within 10 NM of the landing runway when operating in FUSION, or single sensor slant range mode if the aircraft remains within 40 miles of the antenna and:
> Wake turbulence separation must be applied in accordance with TBL 5-5-2;
> An average runway occupancy time of 50 seconds or less is documented;
> CTRDs are operational and used for quick glance references;
> REFERENCE-
> FAA Order JO 7110.65, Para 3-1-9, Use of Tower Radar Displays.
> Turnoff points are visible from the control tower.
> REFERENCE-
> FAA Order JO 7110.65, Para 2-1-19, Wake Turbulence.
> FAA Order JO 7110.65, Para 3-9-6, Same Runway Separation.
> FAA Order JO 7110.65, Para 5-5-7, Passing or Diverging.
> FAA Order JO 7110.65, Para 5-5-9, Separation from Obstructions.
> FAA Order JO 7110.65, Para 5-8-3, Successive or Simultaneous Departures.
> FAA Order JO 7110.65, Para 5-9-5, Approach Separation Responsibility.
> FAA Order JO 7110.65, Para 7-6-7, Sequencing.
> FAA Order JO 7110.65, Para 7-7-3, Separation.
> FAA Order JO 7110.65 Para 7-8-3, Separation.
> FAA Order JO 7210.3, Para 10-4-14, Reduced Separation on Final.

**Sim:** Radar minima: 3 NM terminal (2.5 NM inside 10 NM on final with documented runway occupancy ≤ 50 s); CWT wake matrices TBL 5-5-1 (directly behind) and TBL 5-5-2 (on approach, measured at the threshold).

## 5-5-5

> 5-5-5. VERTICAL APPLICATION
> Aircraft not laterally separated, may be vertically separated by one of the following methods:
> Assign altitudes to aircraft, provided valid Mode C altitude information is monitored and the applicable separation minima is maintained at all times.
> REFERENCE-
> FAA Order JO 7110.65, Para 4-5-1, Vertical Separation Minima.
> FAA Order JO 7110.65, Para 5-2-15, Validation of Mode C Altitude Readout.
> FAA Order JO 7110.65, Para 7-7-3, Separation.
> FAA Order JO 7110.65, Para 7-8-3, Separation.
> FAA Order JO 7110.65, Para 7-9-4, Separation.
> Assign an altitude to an aircraft after the aircraft previously at that altitude has been issued a climb/descent clearance and is observed (valid Mode C), or reports leaving the altitude.
> NOTE-
> Consider known aircraft performance characteristics, pilot furnished and/or Mode C detected information which indicate that climb/descent will not be consistent with the rates recommended in the AIM.
> It is possible that the separation minima described in paragraph 4-5-1, Vertical Separation Minima, paragraph 7-7-3, Separation, paragraph 7-8-3, Separation, or paragraph 7-9-4, Separation, might not always be maintained using subparagraph b. However, correct application of this procedure will ensure that aircraft are safely separated because the first aircraft must have already vacated the altitude prior to the assignment of that altitude to the second aircraft.
> REFERENCE-
> FAA Order JO 7110.65, Para 2-1-3, Procedural Preference.
> FAA Order JO 7110.65, Para 4-5-1, Vertical Separation Minima.
> FAA Order JO 7110.65, Para 5-2-15, Validation of Mode C Altitude Readout.
> FAA Order JO 7110.65, Para 6-6-1, Application.

**Sim:** Vertical separation 1,000 ft below FL 410 is an alternative to radar separation.

## 7-2-1

> 7-2-1. VISUAL SEPARATION
> Visual separation may be applied when other approved separation is assured before and after the application of visual separation. To ensure that other separation will exist, consider aircraft performance, wake turbulence, closure rate, routes of flight, known weather conditions, and aircraft position. Weather conditions must allow the aircraft to remain within sight until other separation exists. Visual separation is not authorized when the lead aircraft is a super.
> REFERENCE-
> FAA Order JO 7110.65, Para 2-1-20, Wake Turbulence Cautionary Advisories.
> FAA Order JO 7110.65, Para 2-1-21, Traffic Advisories.
> FAA Order JO 7110.65, Para 3-1-9, Use of Tower Radar Displays.
> FAA Order JO 7110.65, Para 5-9-5, Approach Separation Responsibility.
> FAA Order JO 7110.65, Para 7-4-1, Visual Approach.
> FAA Order JO 7110.65, Para 7-4-2, Vectors for Visual Approach.
> FAA Order JO 7110.65, Para 7-4-4, Approaches to Multiple Runways.
> FAA Order JO 7210.3, Para 4-3-2, Appropriate Subjects.
> FAA Order JO 7210.3, Para 10-3-9, Visual Separation.
> P/CG Term - Visual Approach.
> P/CG Term - Visual Separation.
> TERMINAL. Visual separation may be applied between aircraft up to but not including FL180 under the following conditions:
> Tower-applied visual separation.
> Maintain communication with at least one of the aircraft involved or ensure there is an ability to communicate immediately with applicable military aircraft as prescribed in paragraph 3-9-3, Departure Control Instructions, subparagraph a2.
> The tower visually observes the aircraft, issues timely traffic advisories, and provides visual separation between the aircraft.
> Issue control instructions as necessary to ensure continued separation between the applicable aircraft.
> Do not apply visual separation between successive departures when departure routes and/or aircraft performance preclude maintaining separation.
> The use of tower-applied visual separation is not authorized when wake turbulence separation is required.
> ATCTs at adjacent airports may be authorized to apply visual separation between their traffic and the other facility's traffic. All provisions of FAA Order JO 7110.65, paragraph 7-2-1a1, still apply.
> NOTE-
> Additional requirements are listed in FAA Order JO 7210.3, paragraph 10-3-9, Visual Separation.
> Pilot-applied visual separation.
> Maintain communication with at least one of the aircraft involved and ensure there is an ability to communicate with the other aircraft.
> The pilot sees another aircraft and is instructed to maintain visual separation from the aircraft as follows:
> Tell the pilot about the other aircraft. Include position, direction, type, and, unless it is obvious, the other aircraft's intention.
> Obtain acknowledgment from the pilot that the other aircraft is in sight.
> Instruct the pilot to maintain visual separation from that aircraft.
> PHRASEOLOGY-
> (ACID), TRAFFIC, (clock position and distance), (direction) BOUND, (type of aircraft), (intentions and other relevant information). 
> If required, 
> (ACID), REPORT TRAFFIC IN SIGHT or DO YOU HAVE IT IN SIGHT?
> If the pilot reports traffic in sight, or the answer is in the affirmative, 
> (ACID), MAINTAIN VISUAL SEPARATION
> NOTE-
> Towers must use the procedures contained in paragraph 3-1-6, Traffic Information, subparagraph b or c, as appropriate.
> If the pilot reports the traffic in sight and will maintain visual separation from it (the pilot must state both), the controller may “approve” the operation instead of restating the instructions.
> PHRASEOLOGY-
> (ACID), APPROVED.
> NOTE-
> Pilot-applied visual separation between aircraft is achieved when the controller has instructed the pilot to maintain visual separation and the pilot acknowledges with their call sign or when the controller has approved pilot-initiated visual separation.
> REFERENCE-
> FAA Order JO 7110.65, Para 5-4-5, Transferring Controller Handoff.
> If aircraft are on converging courses, inform the other aircraft of the traffic and that visual separation is being applied.
> PHRASEOLOGY-
> (ACID), TRAFFIC, (clock position and distance), (direction) BOUND, (type of aircraft), HAS YOU IN SIGHT AND WILL MAINTAIN VISUAL SEPARATION.
> Advise the pilots if the targets appear likely to merge.
> NOTE-
> Issue this advisory in conjunction with the instruction to maintain visual separation, the advisory to the other aircraft of the converging course, or thereafter if the controller subsequently becomes aware that the targets are merging.
> EXAMPLE-
> “Targets appear likely to merge.”
> Control of aircraft maintaining visual separation may be transferred to an adjacent position/sector/facility. Coordination procedures must be specified in an LOA or facility directive.
> REFERENCE-
> FAA Order JO 7210.3, Para 4-3-1, Letters of Agreement.
> EN ROUTE. Visual separation may be used up to but not including FL 180 when the following conditions are met:
> Direct communication is maintained with one of the aircraft involved and there is an ability to communicate with the other.
> A pilot sees another aircraft and is instructed to maintain visual separation from it as follows:
> Tell the pilot about the other aircraft including position, direction, and type. If it is not obvious, include the other aircraft's intentions.
> REFERENCE-
> FAA Order JO 7110.65, Para 2-1-21, Traffic Advisories.
> Obtain acknowledgment from the pilot that the other aircraft is in sight.
> Instruct the pilot to maintain visual separation from that aircraft.
> PHRASEOLOGY-
> (ACID), TRAFFIC, (clock position and distance), (direction) BOUND, (type of aircraft), (intentions and other relevant information). If required, (ACID), REPORT TRAFFIC IN SIGHT or DO YOU HAVE IT IN SIGHT? If the pilot reports traffic in sight, or the answer is in theaffirmative, (ACID), MAINTAIN VISUAL SEPARATION
> If the pilot reports the traffic in sight and will maintain visual separation (the pilot must state both), the controller may “approve” the operation instead of restating the instructions.
> PHRASEOLOGY-
> (ACID), APPROVED.
> NOTE-
> Pilot-app

**Sim:** Visual separation in VMC may substitute for radar separation between arrivals in the tower environment (assist level / visual approach mode).

