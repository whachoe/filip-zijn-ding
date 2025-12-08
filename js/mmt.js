    const categories = [
        'Category 1: Governance, Regulation, and Market Management',
        'Category 2: Infrastructure and Facilities',
        'Category 3: Biosecurity and Hygiene Practices',
        'Category 4: Zoonotic Risk Factors',
        'Category 5: Surveillance and Reporting',
        'Category 6: Risk Communication and Awareness',
        'Category 7: Market Connectivity and Trade Dynamics',
        'Category 8: Emergency Preparedness and Risk Mitigation',
        'Category 9: Stakeholder Engagement'
    ];

    let indicators = [];
    indicators[0] = [
        {
            name: 'Oversight by veterinary / public‑health authorities',
            scores: [
                'No routine inspections; no designated authority',
                'Occasional inspection; unclear authority roles',
                'Regular inspections; authority roles defined',
                'Inspections at defined frequency, enforcement active, authority roles integrated with One Health partners'           
            ]
        },
        {
            name: 'Licensing/registration of market and vendors',
            scores: [
                'Market and vendors operate without registration or licence',
                'Partial registration / informal records',
                'Most vendors registered; market licenced but oversight weak',
                'All vendors registered/licenced, verification system in place, records up‑to‑date'

            ]
        },
        {
            name: 'Presence of market management committee / designated authority',
            scores: [
                'No management committee or designated body',
                'Management body exists but meets rarely / weak capacity',
                'Committee meets regularly, some authority, some coordination with authorities',
                'Committee active, empowered, coordinates with veterinary/public health, holds meetings, agenda, follows up actions'
            ]
        },
        {
            name: 'Enforcement of hygiene, animal welfare, disease‑control regulations',
            scores: [
                'Regulations exist in paper but never enforced',
                'Some regulatory actions but inconsistent or weak',
                'Regulations enforced routinely but occasional non‑compliance remains',
                'Regulations enforced, sanctions applied for non‑compliance, compliance monitoring in place'
            ]
        },
        {
            name: 'Implementation of SOPs for cleaning, disinfection, slaughter & animal handling',
            scores: [
                'No SOPs or not known to staff',
                'SOPs exist but not always followed/monitored',
                'SOPs exist, staff aware, mostly followed, monitoring occasional',
                'SOPs exist, training done, monitoring and corrective actions routine, audit trail present'
            ]
        },
        {
            name: 'Existence of market‑level rules/by‑laws aligned with national policies',
            scores: [
                'No market‑level rules/by‑laws',
                'Some rules exist but not aligned with national policy or not enforced',
                'Rules aligned with national policy, enforced with some gaps',
                'Fully aligned with national policy, regularly reviewed, enforced, documented compliance'
            ]
        }
    ];
    indicators[1] = [
        {
            name: 'Physical layout: species/zone segregation, slaughter/retail zones',
            scores: [
                'Mixed species and uses, no zoning, slaughter in retail area',
                'Some zonation but overlaps; slaughter/retail not clearly separated',
                'Zoning defined, mostly respected, slaughter largely separated from retail',
                'Clear physical zoning, species segregation, slaughter in dedicated area, well‑marked flows'
            ]
        },
        {
            name: 'Adequacy of drainage, solid waste disposal, WASH (water/handwashing) systems',
            scores: [
                'Poor drainage, waste piles, limited hand‑washing facilities',
                'Basic drainage, limited waste disposal, some hand‑washing stations',
                'Good drainage, waste disposal functioning, hand‑washing available but may have interruptions',
                'High standard drainage, waste disposal and removal, multiple hand‑washing/disinfection stations, WASH system reliable'
            ]
        },
        {
            name: 'Access to hand‑washing and disinfection stations',
            scores: [
                'No or minimal stations; not accessible to vendors/visitors',
                'Some stations but limited; no routine maintenance',
                'Stations present, accessible, used regularly though some gaps',
                'Stations well placed, good coverage, maintained, used routinely by vendors/visitors'
            ]
        },
        {
            name: 'Facilities for carcass disposal & wastewater management',
            scores: [
                'Carcasses/waste left on site or disposed openly; wastewater uncontrolled',
                'Basic waste disposal but some open access; wastewater partially managed',
                'Carcass disposal protocols exist, wastewater managed but occasional overflow',
                'Carcass disposal fully managed off‑site or via approved system, wastewater treated or contained, no visible waste/water contamination'
            ]
        },
        {
            name: 'Availability of cold storage / chilling units for products',
            scores: [
                'No cold storage / products often unrefrigerated',
                'Some cold storage but inadequate capacity or maintenance',
                'Cold storage available and functional but not for all products',
                'Cold storage/chilling units available, well‑maintained, sufficient capacity, used routinely'
            ]
        },
        {
            name: 'Holding pens and unloading/loading infrastructure',
            scores: [
                'Holding pens inadequate, mixed species, unloading/loading chaotic',
                'Some pens/unloading area but overcrowded or poorly managed',
                'Holding and unloading systems functioning though may be stressed at peak times',
                'Dedicated holding pens, species segregated, unloading/loading flow well managed, minimize animal stress and mixing'
            ]
        }
    ];  
    indicators[2] = [
        {
            name: 'Movement control for animals, personnel, vehicles',
            scores: [
                'No movement control; animals/people/vehicles move freely',
                'Some control but inconsistent; minimal checks',
                'Movement controls in place, implemented most of the time',
                'Strict movement controls for animals/people/vehicles, entry/exit protocols followed, records kept'
            ]
        },
        {
            name: 'Routine cleaning and disinfection schedules',
            scores: [
                'No schedule; cleaning/disinfection ad hoc or rare',
                'Schedule exists but poorly implemented or monitored',
                'Schedule exists, implemented largely but occasional lapses',
                'Regular cleaning & disinfection schedule strictly followed, monitored, documented, corrective action taken'
            ]
        },
        {
            name: 'Use & accessibility of PPE (gloves, masks, aprons) by vendors/workers',
            scores: [
                'PPE rarely available or used',
                'PPE available but usage inconsistent; training limited',
                'PPE available, most workers use routinely though some exceptions',
                'PPE adequately supplied, used correctly by all staff/vendors, training and compliance monitoring in place'
            ]
        },
        {
            name: 'Procedures for managing sick or dead animals',
            scores: [
                'Sick/dead animals handled openly or disposed unsafely',
                'Some procedures exist but not always followed',
                'Procedures exist, most staff aware and follow though some gaps',
                'Clear procedures exist, staff trained, rapid removal of sick/dead animals, disposal safe and documented'
            ]
        },
        {
            name: 'Cleaning of transport containers and holding pens',
            scores: [
                'Containers/pens cleaned infrequently or not at all',
                'Some cleaning but irregular or inadequate',
                'Cleaning of containers/pens mostly consistent though some minor gaps',
                'Containers/pens cleaned and disinfected after each use, records kept, standardised protocols followed'
            ]
        },
        {
            name: 'Frequency of hand hygiene among workers/vendors',
            scores: [
                'Hand hygiene rarely observed; facilities lacking',
                'Some hand hygiene but inconsistent; training limited',
                'Hand hygiene regularly practiced though may lapse at busy times',
                'Hand hygiene routine, observed compliance high, facilities and training ensure consistent practice'
            ]
        },
    ];
    indicators[3] = [
        {
            name: 'Presence of high‐risk species and level of species mixing',
            scores: [
                'High‐risk species (e.g., wild birds, swine) present; frequent cross‐species mixing',
                'Some high‐risk species/ mixing present but partially controlled',
                'High‐risk species present but mixing limited; controls in place',
                'High‐risk species minimal or well segregated; strict species segregation enforced'
            ]
        },
        {
            name: 'Duration animals held before sale/slaughter',
            scores: [
                'Animals held for long periods (> customised threshold) increasing risk',
                'Animals held moderately long; some efforts to reduce stay time',
                'Holding times within acceptable limits most of the time',
                'Very short holding times, rapid turnover, minimal time for pathogen amplification'
            ]
        },
        {
            name: 'Slaughtering practices within the market premises',
            scores: [
                'On‐site slaughter common, in open area, no dedicated facility',
                'On‐site slaughter present but some controls exist',
                'Slaughtering mostly in dedicated zones with controls though occasional breaches',
                'Slaughtering fully managed in dedicated facility with hygienic conditions, minimal public access, ventilation and waste controls'
            ]
        },
        {
            name: 'Proximity to wetlands/wildlife habitats',
            scores: [
                'Market adjacent to wildlife/ wetlands; frequent contact/exposure',
                'Some proximity but partial separation; occasional wildlife contact',
                'Wildlife contact rare; some buffer zones exist though gaps',
                'Clear buffer zones, minimal wildlife interaction, facility located away from high‐risk habitats'
            ]
        },
        {
            name: 'Signs of environmental contamination (blood, feathers, faeces) visible',
            scores: [
                'Frequent visible contamination; no effective cleaning/controls',
                'Some contamination visible though efforts underway',
                'Rare contamination visible; cleaning and monitoring occurs',
                'No visible contamination, monitoring shows low environmental pathogen load, effective controls in place'
            ]
        },
    ];
    indicators[4] = [
        {
            name: 'Participation in active or passive disease surveillance',
            scores: [
                'No market involvement in surveillance',
                'Market occasionally participates or reports but unsystematic',
                'Market regularly participates in surveillance albeit with some limitations',
                'Market fully integrated in surveillance (active & passive), routine data flow to authorities'
            ]
        },
        {
            name: 'Submission of animal or environmental samples for lab testing',
            scores: [
                'No sample submission or very rare',
                'Occasional sample submission but limited species/ frequency',
                'Samples submitted regularly for priority species/ environments though some gaps',
                'Comprehensive sample submission (animals + environment) at defined intervals, results linked to actions'
            ]
        },
        {
            name: 'Presence of disease detection / case reporting mechanisms',
            scores: [
                'No reporting mechanism; staff unaware',
                'Some mechanism exists but usage low or delayed',
                'Reporting mechanism working, most staff aware, reports submitted but maybe delays',
                'Well‑defined, functional reporting mechanism, timely, with feedback to market, integrated with lab/field network'
            ]
        },
        {
            name: 'Use of digital or manual early‑warning / data‑systems',
            scores: [
                'No early‑warning system or data capture',
                'Basic manual system exists but incomplete or not timely',
                'Digital/manual early‑warning used regularly but may not cover all risks',
                'Robust early‑warning system (digital/manual), linkage to veterinary/public health, timely alerts and responses'
            ]
        },
        {
            name: 'Coordination with animal and public‑health authorities',
            scores: [
                'Little to no coordination; market alone',
                'Coordination ad hoc; some contact between market & authorities',
                'Coordination formalised; regular meetings though may lack full integration',
                'High level coordination between market, veterinary, public health, One Health framework, regular joint exercises/reviews'
            ]
        },
        {
            name: 'History of zoonotic/pathogen detection in the market',
            scores: [
                'No history or unknown; if positive never followed up',
                'Some detection but follow‑up weak',
                'Detections occur; follow‑up action usually implemented',
                'Regular monitoring reveals no positive/detected minimal; if detection occurs, prompt response, plus records used for improvement'
            ]
        },
    ];
    indicators[5] = [
        {
            name: 'Availability of signage/IEC materials on hygiene and disease prevention',
            scores: [
                'None or very poor materials, not visible',
                'Some materials present but outdated or poorly located',
                'Good quality materials present and visible though may not reach all users',
                'Up‑to‑date, culturally appropriate signage/IEC present throughout market, regularly reviewed and accessible'
            ]
        },
        {
            name: 'Training history of vendors/workers on zoonoses, biosecurity etc.',
            scores: [
                'No training or very infrequent',
                'Occasional training but coverage limited or unmonitored',
                'Training regularly conducted though might not cover all staff/new entrants',
                'Training comprehensive (initial + refresher), full coverage of vendors/ staff, records available, impact assessed'
            ]
        },
        {
            name: 'Results from KAP (Knowledge, Attitudes, Practices) assessments',
            scores: [
                'No KAP data; knowledge/ practices poor',
                'KAP done but irregular; results weakly used',
                'KAP undertaken periodically; results used to inform practice though gaps remain',
                'Regular KAP assessments, results improve over time, practices show measurable improvement'
            ]
        },
        {
            name: 'Use of culturally appropriate risk messaging',
            scores: [
                'Messaging standard/ generic, low relevance to users',
                'Some tailored messaging but coverage limited',
                'Good culturally‑relevant messaging used though may not reach all target groups',
                'Messaging fully tailored to local culture/language/ gender/ groups, strong uptake and behavioural change evident'
            ]
        },
        {
            name: 'Channels for communication with communities during outbreaks',
            scores: [
                'No dedicated channels or communication plan',
                'Some channels exist but not used or not effective',
                'Channels in place and used during outbreaks though may lack full reach',
                'Robust communication channels (vendors, community, authorities), tested in drills, messaging timely and effective'
            ]
        }
    ];
    indicators[6] = [
        {
            name: 'Sources & destinations of traded animals (local, regional, cross‑border)',
            scores: [
                'Wide informal sources, cross‐border uncontrolled, no traceability',
                'Sources partly known but many informal; cross‐border trade partially monitored',
                'Most sources documented, cross‐border trade monitored though informal flows remain',
                'All sources traceable, cross‐border trade regulated, full documentation of destinations and origins'
            ]
        },
        {
            name: 'Frequency and scale of trade (daily/seasonal/peak periods)',
            scores: [
                'Very high frequency/volume with little control/monitoring',
                'High volume but some controls; peaks unmanaged',
                'Trade frequency and volumes are monitored and peaks managed though some risk remains',
                'Trade volumes well known & monitored; peak periods anticipated & managed with risk mitigation measures'
            ]
        },
        {
            name: 'Role in value‑chain (collection, wholesale, retail terminal)',
            scores: [
                'Market acts as major collection/aggregation hub, high mixing and risk',
                'Market role is mixed; some segregation of roles but risk remains',
                'Value‑chain role known, some mitigation for aggregation risk though occasional mixing remains',
                'Value‑chain role clearly defined, flow managed to minimise risk, aggregation steps controlled & documented'
            ]
        },
        {
            name: 'Mapping of animal‑movement routes and aggregation points',
            scores: [
                'Routes unknown/unregulated; aggregation unmonitored',
                'Some mapping of main routes but many unmonitored/ informal',
                'Routes mapped for main flows though smaller flows not fully captured',
                'Full mapping of movement routes, aggregation points, monitored and managed for disease risk'
            ]
        },
        {
            name: 'Cross‑border movement or unregulated informal trade links',
            scores: [
                'Large informal/unregulated cross‑border trade, high risk',
                'Some informal trade but controls beginning',
                'Informal trade reduced/regulated, cross‑border trade mostly monitored though gaps persist',
                'Informal/unregulated trade minimal, cross‐border trade fully regulated, formalised, traceable'
            ]
        }
    ];
    indicators[7] = [
        {
            name: 'Existence of contingency / outbreak response plans',
            scores: [
                'No plan or very limited plan',
                'Plan exists but untested, limited coverage',
                'Plan exists, tested occasionally, most stakeholders aware though not all',
                'Fully documented response plan, tested via drills, stakeholders trained, resources allocated'
            ]
        },
        {
            name: 'Isolation/quarantine spaces for sick animals',
            scores: [
                'No isolation/quarantine facility or poorly defined',
                'Facility exists but limited capacity or rarely used',
                'Facility defined and used though may not cover peak capacity',
                'Adequate isolation/quarantine facility present, used as needed, protocol defined and executed promptly'
            ]
        },
        {
            name: 'Availability of emergency sanitation supplies (disinfectants, PPE, etc.)',
            scores: [
                'Supplies minimal or stockouts frequent',
                'Supplies available but inventory unstable/ not routinely checked',
                'Emergency supplies present and checked though may need replenishment',
                'Fully stocked emergency supplies, inventory system in place, routine checks, ready for outbreak use'
            ]
        },
        {
            name: 'Past participation in simulation or tabletop exercises',
            scores: [
                'No simulations/exercises conducted',
                'Some tabletop/simulation exercise but limited participants or scope',
                'Exercises conducted regularly though some stakeholder groups may not be included',
                'Full-scale simulation and tabletop exercises conducted regularly, all stakeholders included, lessons learned used for improvement'
            ]
        },
        {
            name: 'Historical closure or restriction events due to outbreaks',
            scores: [
                'No record or closures reactive and prolonged',
                'Some closures but response delayed/management weak',
                'Outbreak closures/restrictions managed but some delay or suboptimal recovery',
                'Rapid closure/restriction when required, outbreak response efficient, market re‑opening based on risk criteria and good recovery'
            ]
        }
    ];
    indicators[8] = [
        {
            name: 'Engagement of vendors, traders, transporters in market improvements',
            scores: [
                'No engagement of market actors, top‑down only',
                'Some engagement but participation minimal or token',
                'Vendors/traders engaged fairly regularly but not fully empowered',
                'High level engagement with market actors; they actively participate in improvement initiatives and decision‑making'
            ]
        },
        {
            name: 'Participation in biosecurity or disease‑control programmes',
            scores: [
                'Market actors not involved in programmes',
                'Some actors involved but many excluded',
                'Majority of actors aware/ involved though some gaps',
                'All relevant market actors involved in programmes, active participation, sustained commitment'
            ]
        },
        {
            name: 'Feedback mechanisms for market users to engage with authorities',
            scores: [
                'No feedback mechanism or rarely used',
                'Feedback mechanism exists but not responsive or inclusive',
                'Feedback mechanism works though some groups not represented',
                'Robust feedback mechanism in place, inclusive, responsive, authorities act on feedback, results communicated back'
            ]
        },
        {
            name: 'Inclusion of women, marginalized groups, or smallholders',
            scores: [
                'Women/marginalised largely excluded, smallholders uninvolved',
                'Some inclusion but limited representation or empowerment',
                'Good inclusion though some gaps in voice or influence',
                'Strong inclusive governance and engagement of women, marginalised groups, smallholders; equitable participation in decision‑making'
            ]
        },
        {
            name: 'Existence of vendor associations or cooperatives contributing to safe trade',
            scores: [
                'No association/cooperative or inactive',
                'Association exists but weak or low membership',
                'Association functional though resource‑limited or coverage partial',
                'Strong vendor association/cooperative fully functional, supports safe trade, influences policy, monitors compliance'
            ]
        }
    ];

//////////////////////////////// END OF INDICATOR DATA //////////////////////////////

    function generate_assessment_form(categories, indicators) {
        let html = `        
          <div id="my-slider" class="swiffy-slider slider-nav-arrow slider-nav-outside-expand slider-item-first-visible slider-nav-noloop slider-item-nogap slider-indicators-round slider-indicators-sm" aria-roledescription="carousel">
          <form id="assessment-form" onsubmit="save_assessment(); return false;">
            <ul class="slider-container">`;

        let visible_class = "slide-visible";    
        categories.forEach((category, catIdx) => {
            // console.log(category, catIdx);            
            html += `
            <li id="slide-${catIdx+1}" class="${visible_class}">
            <fieldset id="category-${catIdx}">
            <legend>${category}</legend>`;

            indicators[catIdx].forEach((indicator, indIdx) => {
                html += `<span class="indicator-label">${indicator.name}</span>`;
                indicator.scores.forEach((score, scoreIdx) => {
                    html += `<input type="radio" id="indicator-${catIdx}-${indIdx}-${scoreIdx}" class="indicator-value" name="indicator[${catIdx}][${indIdx}]" value="${scoreIdx + 1}" required /><label for="indicator-${catIdx}-${indIdx}-${scoreIdx}">${score}</label><br/>`;
                });
            });

            let save_button = catIdx === categories.length - 1 ? `<input type="submit" class="save-btn" value="Save"></input>` : '';
            html += `      
                ${save_button}
                </fieldset></li>`;
            visible_class = "";
        });
        
        html += ` 
          </ul>               
            <button class="slider-nav" aria-abel="Previous page"></button>
            <button class="slider-nav slider-nav-next" aria-label="Next page"></button>

            <ul class="slider-indicators">
                <li class="active"></li>
                <li></li>
                <li></li>
                <li></li>
                <li></li>
                <li></li>
                <li></li>
                <li></li>
                <li></li>
            </ul>
          </form>  
          </div>`;

        return html;
    }

    function calculate_percentage(scores, catX) {
        let scoreCount = indicators[catX].length; // How many indicators in this category
        let scoreTotal = 0;
        let maxScore = 4*scoreCount; // Max score per indicator is 4

        for (i=0; i < scoreCount; i++) {
            let label = "indicator["+catX+"]["+i+"]";
            scoreTotal += parseInt(scores[label]);
        }        

        return Math.round((scoreTotal * 100)/maxScore);
    }
    
    function generateScoretable() {
        // Fetch the last 3 assessments
        let assessmentList = JSON.parse(localStorage.getItem('assessment_list'));
        // let last3 = assessmentList ? assessmentList.slice(1).slice(-3) : [];
        // console.log("Last 3:", last3);

        let currentId   = assessmentList.pop();    // newest
        let previous2Id = assessmentList.pop();    // middle child
        let previous1Id = assessmentList.pop();    // oldest
        console.log(currentId, previous2Id, previous1Id);

        let current   = currentId ? JSON.parse(localStorage.getItem(currentId)) : null;
        let previous2 = previous2Id ? JSON.parse(localStorage.getItem(previous2Id)) : null;
        let previous1 = previous1Id ? JSON.parse(localStorage.getItem(previous1Id)) : null;

        let scoretable = [];
        categories.forEach((cat, catX) => {
            scoretable[catX] = [];
            scoretable[catX][0] = cat;
            scoretable[catX][1] = current   ? calculate_percentage(current.scores, catX)   : 0;
            scoretable[catX][2] = previous2 ? calculate_percentage(previous2.scores, catX) : 0;
            scoretable[catX][3] = previous1 ? calculate_percentage(previous1.scores, catX) : 0;
        });

        return scoretable;
    }

    function calculate_warning_level(score) {
        if (score < 20) {
            return "warning1";
        } else if (score < 40) {
            return "warning2";
        } else if (score < 60) {
            return "warning3";
        } else if (score < 80){
            return "warning4";
        } else {
            return "warning5";
        }
    }

    function render_scoretable(scoretable) {
        u('table#reports-scoretable tbody').html('');
        scoretable.forEach((row) => {
            let rowHtml = `
            <tr>
                <td>${row[0]}</td>
                <td align="center"class="${calculate_warning_level(row[1])}">${row[1]}</td>
                <td align="center" class="${calculate_warning_level(row[2])}">${row[2]}</td>
                <td align="center" class="${calculate_warning_level(row[3])}">${row[3]}</td>
            </tr>
            `;

            u('table#reports-scoretable tbody').append(rowHtml);
        });
    }

    function render_radargraph(scoretable) {
        const data = {
            labels: categories,
            datasets: [{
                label: 'Current',
                data: scoretable.map(function(value) { return value[1]; }),
                fill: true,
                backgroundColor: '#cc3300',
                borderColor: 'rgb(255, 99, 132)',
                pointBackgroundColor: 'rgb(255, 99, 132)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgb(255, 99, 132)'
            }, {
                label: 'Previous 1',
                data: scoretable.map(function(value) { return value[2]; }),
                fill: true,
                backgroundColor: '#ff9966',
                borderColor: 'rgb(54, 162, 235)',
                pointBackgroundColor: 'rgb(54, 162, 235)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgb(54, 162, 235)'
            }, {
                label: 'Previous 2',
                data: scoretable.map(function(value) { return value[3]; }),
                fill: true,
                backgroundColor: '#ffcc00',
                borderColor: 'rgb(54, 162, 235)',
                pointBackgroundColor: 'rgb(54, 162, 235)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgb(54, 162, 235)'
            }]
            };

        const config = {
            type: 'radar',
            data: data,
            options: {
                elements: {
                    line: {
                        borderWidth: 1
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            },
        };

        const ctx = document.getElementById('radar-graph');
        let chart = Chart.getChart("radar-graph"); 
        if(chart){
            chart.clear();
            chart.destroy();
        }

        const radarChart = new Chart(ctx, config);
    }

    function render_bargraph(scoretable) {        
        const data = {
            labels: categories,
            datasets: [{
                axis: 'y',
                label: 'Current',
                data: scoretable.map(function(value) { return value[1]; }),
                fill: true,
                backgroundColor: '#cc3300',
                borderColor: 'rgb(255, 99, 132)',
                borderWidth: 1
            },
            {
                axis: 'y',
                label: 'Previous 1',
                data: scoretable.map(function(value) { return value[2]; }),
                fill: true,
                backgroundColor: '#ff9966',
                borderColor: 'rgb(54, 162, 235)',
                borderWidth: 1
            },
            {
                axis: 'y',
                label: 'Previous 2',
                data: scoretable.map(function(value) { return value[3]; }),
                fill: true,
                backgroundColor: '#ffcc00',
                borderColor: 'rgb(54, 162, 235)',
                borderWidth: 1
            }
        ]};

        const config = {
            type: 'bar',
            data,
            options: {
                plugins: {
                    legend: {
                        display: false
                    }
                },
                indexAxis: 'y',
            }};

        const ctx = document.getElementById('bar-graph');
        let chart = Chart.getChart("bar-graph"); 
        if(chart){
            chart.clear();
            chart.destroy();
        }

        const barChart = new Chart(ctx, config);    
    }



    function refreshReports() {
        // Filling up the Reports tab
        let scoretable = generateScoretable();

        render_scoretable(scoretable)
        render_radargraph(scoretable);
        render_bargraph(scoretable);
    }

    function create_assessment_id(date) {
        const curDate = date || new Date();

        // Format: Y-m-d
        return 'assessment-' + curDate.getFullYear() + '-' + (curDate.getMonth()+1) + '-' + curDate.getDate();
    }

    function save_assessment() {

        // Fetch the scores
        const assesmentForm = document.getElementById('assessment-form');
        const formData = new FormData(assesmentForm);
        const scores = Object.fromEntries(formData.entries());
        
        // Fetch contact info from settings-screen
        const contactForm = document.getElementById('settings-form');
        const contactData = new FormData(contactForm);
        const contactInfo = {
            fullname: contactData.get('full-name'),
            email: contactData.get('email-address'),
            location: contactData.get('location')
        };
        
        // Prepare assessment data object
        const curDate = new Date().toISOString();
        const assessmentData = {
            contactInfo: contactInfo,
            scores: scores,
            created: curDate
        }

        // Save assessmentData to server or local storage
        let assessmentId = create_assessment_id();
        localStorage.setItem(assessmentId, JSON.stringify(assessmentData));

        // Now update the assessment list
        let assessmentList = JSON.parse(localStorage.getItem('assessment_list'));
        if (!assessmentList) assessmentList = [];
        assessmentList.push(assessmentId);
        localStorage.setItem("assessment_list", JSON.stringify(makeArrayUnique(assessmentList)));

        // Now redirect to reports panel
        refreshReports();
        u('button#tab-reports').trigger('click');
    }

    function create_random_assessment(indicators) {
        const curDate = generateRandomDate(new Date(2023, 0, 1), new Date());
        let assessmentId = create_assessment_id(curDate);
        let scores = {};
        indicators.forEach((cat, catX) => {
            cat.forEach((indicator, indX) => {
                scoreIdx = "indicator["+catX+"]["+indX+"]";
                scores[scoreIdx] = Math.floor(Math.random() * indicator.scores.length) + 1;
            });
        });
        
        let newAssessment = {
            contactInfo: {
                fullname: 'John Doe',
                email: 'jdoe@fake.com',
                location: 'New York, USA'
            },
            scores: scores,
            created: curDate.toISOString()
        };

        // Save the assessment to localstorage
        localStorage.setItem(assessmentId, JSON.stringify(newAssessment));

        // Now update the assessment list
        let assessmentList = JSON.parse(localStorage.getItem('assessment_list'));
        if (!assessmentList) assessmentList = [];
        
        assessmentList.push(assessmentId);
        localStorage.setItem("assessment_list", JSON.stringify(makeArrayUnique(assessmentList)));
    }

    /**
     * Convert scores object in the form {indicator[cat][ind]: score, ...} to a 2D array with cat and ind dimensions
     * 
     */
    function scores_to_2d_array(scores) {
        let scoreArray = [];
        indicators.forEach((cat, catX) => {
            scoreArray[catX] = [];
            cat.forEach((indicator, indX) => {
                let label = "indicator["+catX+"]["+indX+"]";
                scoreArray[catX][indX] = scores[label];
            });
        });

        return scoreArray;
    }

    function scores_to_array(scores) {
        let scoreArray = [];
        indicators.forEach((cat, catX) => {            
            cat.forEach((indicator, indX) => {
                let label = "indicator["+catX+"]["+indX+"]";
                scoreArray.push(scores[label]);
            });
        });

        return scoreArray;
    }


    function export_xlsx() {
        let assessmentList = JSON.parse(localStorage.getItem('assessment_list'));
        let globalContactInfoJSON = localStorage.getItem('contactInfo');
        if (!assessmentList) assessmentList = [];
        
        let scores = [];
        let merges = [];

        assessmentList.forEach((assessmentId) => {
            let assessment = JSON.parse(localStorage.getItem(assessmentId));

            // Prepare header row for scores sheet
            if (scores.length === 0) {
                let categoryRow = ['','','',''];
                let headerRow = ['Date', 'Contact Name', 'Email', 'Location'];
                let startcol = headerRow.length;

                indicators.forEach((cat, catX) => {                                
                    // Calculate merges    
                    endcol = startcol + cat.length - 1;
                    merges.push({ s: { r:0, c:startcol }, e: { r:0, c:endcol }});
                    startcol = endcol + 1;

                    cat.forEach((indicator, indX) => {
                        // Only add category label for first indicator in that category
                        if (indX > 0)
                            categoryRow.push('');
                        else {
                            let catLabel = categories[catX];
                            categoryRow.push(catLabel);
                        }

                        // Add indicator label to header row
                        let label = indicator.name;
                        headerRow.push(label);
                    });
                });
                scores.push(categoryRow);
                scores.push(headerRow);
            }

            let scoreRow = scores_to_array(assessment.scores);
            scoreRow.unshift(assessment.created, assessment.contactInfo.fullname, assessment.contactInfo.email, assessment.contactInfo.location);
            scores.push(scoreRow);
        });

        console.log(scores);

        // Create workbook and add the worksheets
        let wb = XLSX.utils.book_new();
        // let ws = XLSX.utils.json_to_sheet(globalContactInfoJSON);
        let ws2 = XLSX.utils.aoa_to_sheet(scores);
        ws2['!merges'] = merges;
        // merges.forEach((merge) => {
        //     console.log(merge); 
        //     ws2[merges.s].s = {
        //         type: 'style',
        //         fill: {
        //             type: 'pattern',
        //             patternType: 'solid',
        //             fgColor: { rgb: 'FFFF0000' }, // Red color
        //         },
        //         };
        // });
        // XLSX.utils.book_append_sheet(wb, ws, "MMT Assessments - Contact Info");
        XLSX.utils.book_append_sheet(wb, ws2, "MMT Indicator Scores");

        // Export to file
        XLSX.writeFile(wb, "mmt_assessments.xlsx");        
    }

    /////////////////////////////// GLOBAL INIT ////////////////////////////////

    // Refresh the Reports tab
    refreshReports();

    // Generate the Assessment Form
    document.getElementById('new_assessment_wrapper').innerHTML = generate_assessment_form(categories, indicators);

    // Add the Next and Previous buttons to handle navigation
    u(document.querySelectorAll('.next-btn')).each(btn => btn.addEventListener('click', (e) => {
        let cat = e.currentTarget.getAttribute('category');
        u(document.getElementById('category-${cat}')).addClass('hidden');
        u(document.getElementById('category-${cat+1}')).removeClass('hidden');
    }));
    u(document.querySelectorAll('.prev-btn')).each(btn => btn.addEventListener('click', (e) => {
        let cat = e.currentTarget.getAttribute('category');
        
        u(document.getElementById('category-${cat}')).addClass('hidden');
        u(document.getElementById('category-${cat-1}')).removeClass('hidden');
    }));

    // Comment this line out. only used for testing
    // callNTimes(function() { create_random_assessment(indicators); }, 5, 100);    