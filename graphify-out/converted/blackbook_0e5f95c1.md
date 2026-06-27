<!-- converted from blackbook.docx -->

A PROJECT REPORT ON
AI-POWERED MOCK INTERVIEW PLATFORM

SUBMITTED TO THE SAVITRIBAI PHULE PUNE UNIVERSITY, PUNE
IN THE PARTIAL FULFILLMENT OF THE REQUIREMENTS FOR THE AWARD OF THE DEGREE
OF
BACHELOR OF ENGINEERING
IN
INFORMATION TECHNOLOGY

SUBMITTED BY
MR. HARSH CHAUDHARI				EXAM NO: B400430357
MR. SHUBHAM GADHAVE				EXAM NO: B400430362
MR. AMAN JAMBULKAR			            	EXAM NO: B400430368
MR. MOHIT KOLAPKAR				            EXAM NO: B400430376

UNDER THE GUIDANCE OF
PROF. K.S. SANGHAVI


DEPARTMENT OF INFORMATION TECHNOLOGY
STES’S SINHGAD ACADEMY OF ENGINEERING
KONDHWA BK, PUNE 411048
ACADEMIC YEAR 2025-26

CERTIFICATE
This is to certify that the project report entitles
AI-POWERED MOCK INTERVIEW PLATFORM
Submitted by
MR. HARSH CHAUDHARI				EXAM NO: B400430357
MR. SHUBHAM GADHAVE				EXAM NO: B400430362
MR. AMAN JAMBULKAR			                        EXAM NO: B400430368
MR. MOHIT KOLAPKAR				            EXAM NO: B400430376

is a bonafide work has been carried out by them under the supervision of Prof. K.S. Sanghavi and it is approved for the partial fulfilment of the requirement of Savitribai Phule Pune University, for the award of the degree of Bachelor of Engineering (INFORMATION TECHNOLOGY).


Prof. K. S. Sanghavi 		                 Dr. S.S. Kulkarni			        Dr. K. P. Patil
Guide   			              H.O.D.				Principal
Department of 			        Department of			          SAOE, Pune
Information Technology 	           Information Technology




Place: Pune				   					     Dr. Sunil L. Bangare
Date:      /      / 2026			   External Examiner		                Project Coordinator
ACKNOWLEDGEMENT


I hereby take this opportunity to record my sincere thanks and heartily gratitude to Prof. K. S. Sanghavi for his useful guidance and making available to me his intimate knowledge and experience in making “AI-Powered Mock Interview Platform” as a preparation of report in respect thereof. I am also thankful to my respective HOD Dr. S.S. Kulkarni of my Information Technology department. I express my special thanks and heartily gratitude to my respective staff members for inspiring me throughout the completion of this system. The acknowledge will be incomplete if I don’t record sense of gratitude to my principal. I also express my sincere thanks to all those i.e., the management, lab assistants, my friends and family who have provided me valuable guidance towards the completion of this presentation as a part of the syllabus of the course.
I express my sincere gratitude towards co-operative department who have provided me with valuable assistance and requirements for the presentation.

Project Group Members:
MR. HARSH CHAUDHARI				PRN: 72029219M
MR. SHUBHAM GADHAVE				PRN: 72029320M
MR. AMAN JAMBULKAR					PRN: 72029281G
MR. MOHIT KOLAPKAR					PRN: 72029267M






ABSTRACT

Abstract— The AI-Powered Mock Interview Platform is a cutting-edge online tool created to help job seekers and students prepare for interviews. It has a Firebase backend and a React frontend, and integrates the Google Gemini API for intelligent question generation and performance feedback. Authentication, interview setup with customizable job parameters, interactive Q&A sessions, and comprehensive AI-driven feedback are all guided by the system. Professional preparation is now accessible to everyone thanks to its scalable, customized practice environment that bridges the gap between theoretical knowledge and real-world interview expectations. It also has features for voice/text responses and progress tracking. Additionally, the platform enhances user confidence by providing real-time analysis, personalized improvement suggestions, and adaptive questioning based on user performance. Its intuitive interface and cloud-based architecture ensure accessibility, reliability, and seamless user experience across devices, making it an effective solution for modern interview preparation.

Keywords: Google Gemini API, React Frontend, Firebase Backend, Intelligent Question Generation, Performance Feedback, Voice and Text Analysis, Interview Simulation, Confidence Evaluation, Personalized Learning, Progress Tracking









LIST OF FIGURES

Figure 1.Software Development Lifecycle	16
Figure 2. Iterative Scrum Model	16
Figure 3. DFD Level 0	23
Figure 4. DFD Level 1	24
Figure 5. DFD Level 2	25
Figure 6. Use-Case Diagram	26
Figure 7. Class Diagram	27
Figure 8. Sequence Diagram	28
Figure 9. Activity Diagram	29
Figure 10. Time-Line Chart	36
Figure 11. System Architecture	38
Figure 12. LLM-BASED QUESTION GENERATION ALGORITHM	41
Figure 13. LLM-AUGMENTED GENERATION (LAG) ALGORITHM	42



LIST OF TABLES
Table 1. Effort Estimate Timetable	31
Table 2. Project Schedule	32
Table 3. KLOC of Modules	32



















CHAPTER 1
INTRODUCTION



# Chapter 1 INTRODUCTION

## INTRODUCTION
In today’s highly competitive job market, candidates are required to demonstrate not only strong technical knowledge but also effective communication skills, confidence, and problem-solving ability during interviews. Recruitment processes in modern organizations have evolved significantly, with companies increasingly relying on structured technical and behavioral interviews to evaluate candidates. However, many job seekers face difficulties when preparing for such interviews due to the lack of realistic practice environments. Traditional preparation methods, such as reading interview questions, watching tutorial videos, or practicing with friends, often fail to simulate the real pressure and dynamic interaction of an actual interview scenario.
With the advancement of Artificial Intelligence (AI) and cloud-based technologies, it has become possible to create intelligent systems that can simulate real-world scenarios and provide automated evaluation. AI-driven platforms can analyze user responses, generate contextual questions, and provide feedback instantly. These capabilities make AI an ideal technology for building advanced interview preparation systems. In this context, the AI-Powered Mock Interview Platform was developed to provide candidates with a realistic, interactive, and intelligent interview practice environment.
The AI-Powered Mock Interview Platform is a full-stack web application designed to simulate real technical and HR interview experiences using modern web technologies and generative AI. The system dynamically generates interview questions based on the candidate’s selected role, technology stack, and experience level. Unlike traditional mock interview systems that rely on static question banks, this platform leverages advanced natural language processing capabilities from Google Gemini to create personalized interview questions and evaluate candidate responses in real time. This approach enables the platform to deliver a more adaptive and realistic interview experience.
The application is built using a modern technology stack that ensures scalability, performance, and a responsive user interface. The frontend is developed using React and TypeScript, allowing the system to provide an interactive and user-friendly experience. For backend services and data management, the platform uses Firebase, which offers secure cloud storage, authentication integration, and serverless computing through cloud functions. These technologies work together to ensure efficient communication between the user interface, the AI engine, and the database.
One of the key objectives of the platform is to replicate real interview conditions as closely as possible. To achieve this, the system incorporates speech recognition and webcam integration. During the interview process, candidates are required to answer questions using their microphone and webcam, creating an immersive experience similar to remote technical interviews conducted by companies. The speech input is automatically converted into text using browser-based speech recognition technologies, enabling the system to analyze and evaluate the candidate’s response.
In addition to evaluating technical correctness, the system also analyzes behavioral indicators such as speech patterns, communication clarity, and confidence levels. A specialized confidence scoring mechanism processes parameters such as speaking speed, filler word frequency, and webcam movement to estimate the candidate’s level of confidence during the interview. This feature provides valuable insights that help candidates identify areas of improvement in their communication and presentation skills.
Another important aspect of the system is maintaining the authenticity and fairness of the mock interview process. Many online practice platforms lack mechanisms to ensure that users remain focused during the interview session. To address this issue, the platform includes a built-in anti-cheating detection mechanism that monitors user activity during the interview. The system tracks events such as tab switching or window minimization and applies a “10-Strike Rule,” where repeated violations trigger warnings and eventually terminate the session. This feature simulates the proctoring mechanisms used in professional remote assessments and ensures that the mock interview experience remains realistic.
The platform also provides multilingual support, allowing candidates to answer questions in multiple languages such as English, Hindi, and Marathi. This feature improves accessibility for users who may be more comfortable communicating in their native language while still receiving structured evaluation feedback from the AI system. The AI model translates responses internally and compares them against expected concepts to generate accurate scores and feedback.
Furthermore, the system stores interview sessions and evaluation results securely in the cloud. Candidates can review their past interviews, analyze feedback, and track their progress over time. This continuous feedback loop enables users to refine their interview strategies, improve technical explanations, and enhance communication skills through repeated practice.
Overall, the AI-Powered Mock Interview Platform represents an innovative approach to interview preparation by combining generative AI, speech recognition, behavioral analytics, and cloud computing technologies. The system provides candidates with an automated, interactive, and data-driven interview practice environment that helps them prepare effectively for real-world recruitment processes. By bridging the gap between theoretical preparation and practical interview experience, the platform aims to improve candidate confidence, enhance technical communication, and ultimately increase the chances of success in job interviews.
## OBJECTIVES OF PROJECT REPORT
The aims of this study are:
- The primary objective of the AI-Powered Mock Interview Platform is to develop an intelligent and interactive system that helps candidates prepare effectively for real-world technical and HR interviews. The project aims to leverage modern web technologies, cloud computing, and artificial intelligence to create a realistic interview simulation environment that can evaluate candidate performance automatically. By integrating AI-driven question generation, speech recognition, and performance analytics, the system seeks to bridge the gap between theoretical interview preparation and practical interview experience.
- One of the major objectives of the project is to design and implement a dynamic interview system that can generate interview questions based on specific job roles, technologies, and experience levels. Unlike traditional systems that rely on predefined question banks, the platform uses advanced generative AI models such as Google Gemini to create personalized questions for each candidate. This ensures that every interview session is unique and closely aligned with real industry expectations.
- The project also aims to simulate a realistic interview environment by incorporating audio and video interaction. Candidates are required to use their microphone and webcam while answering questions, which creates a more immersive interview experience. This feature is designed to replicate remote interview settings used by modern companies. The frontend of the system is developed using technologies such as React, enabling responsive user interfaces and seamless interaction with camera and speech recognition APIs.
- Another objective of the project is to build a scalable and secure cloud-based architecture for managing interview sessions and user data. The system stores interview records, feedback reports, and performance analytics in a cloud database such as Firebase, allowing users to access their interview history and track their progress over time.
- Finally, the project aims to create a user-friendly and accessible platform that encourages continuous learning and improvement. By providing automated mock interviews, detailed feedback, and performance insights, the system helps candidates enhance their technical knowledge, communication abilities, and overall confidence before attending real job interviews.
## ORGANIZATION OF PROJECT REPORT
- Chapter 2 Deals with the Project Related Work i.e., Literature Survey.
- Chapter 3 Giving an overall view of the techniques used in the system
- Chapter 4 Deals with System Design.
- Chapter 5 Project Plan
- Chapter 6 Implementation Part
- Chapter 7 Testing
- Chapter 8 Conclusion
- Chapter 9 references










CHAPTER 2
LITERATURE SURVEY
# Chapter 2 LITERATURE SURVEY

## LITERATURE SURVEY
The rapid advancement of Artificial Intelligence (AI), cloud computing, and web technologies has significantly influenced the development of intelligent learning and evaluation systems. One of the emerging applications of these technologies is the automation of recruitment and interview preparation processes. A literature survey is essential to understand the existing research, methodologies, and technological approaches related to automated interview systems, AI-based evaluation, and online assessment platforms. This section reviews relevant studies, technologies, and systems that have contributed to the development of AI-powered mock interview platforms and highlights the research gap addressed by the proposed system.
Evolution of Online Interview Preparation Platforms
Traditional interview preparation methods primarily consisted of reading books, practicing commonly asked questions, or attending coaching sessions. While these approaches provide theoretical knowledge, they lack the practical experience required to perform confidently in real interview scenarios. Researchers and educators have recognized this limitation and have proposed various online systems to simulate interviews.
Early interview preparation platforms mainly relied on static databases containing predefined interview questions. These systems presented questions to candidates and allowed them to practice answering them manually. However, these platforms lacked interactive feedback mechanisms and were unable to adapt questions according to the candidate’s profile or performance level. As a result, the effectiveness of such systems was limited.
With the development of web technologies and intelligent algorithms, modern systems have started incorporating adaptive learning mechanisms. These platforms analyze user inputs and modify questions dynamically based on previous responses. Although these systems improved the personalization of interview preparation, they still depended heavily on rule-based algorithms and lacked advanced natural language processing capabilities required for evaluating open-ended responses.
Artificial Intelligence in Recruitment and Interview Systems
Artificial Intelligence has played a significant role in transforming the recruitment and hiring process. AI-based systems can analyze candidate data, evaluate communication skills, and automate several tasks that traditionally required human intervention. Recent research has focused on developing intelligent interview systems that use machine learning and natural language processing to evaluate candidate responses.
Large language models and transformer-based architectures have proven highly effective for processing human language. Modern AI models, such as Google Gemini, have the capability to understand contextual information, generate human-like responses, and evaluate textual content. These capabilities make such models suitable for generating interview questions and assessing candidate answers in real time.
Researchers have demonstrated that AI-powered conversational systems can simulate human interviewers by asking follow-up questions and evaluating the relevance of candidate responses. These systems use natural language processing techniques to analyze grammar, semantics, and contextual meaning. The integration of AI in interview platforms allows candidates to receive immediate feedback, enabling them to improve their performance through repeated practice sessions.
However, several studies highlight challenges associated with AI-based interview systems. One major challenge is ensuring the accuracy and fairness of automated evaluations. AI models must be trained or guided using appropriate prompts and evaluation criteria to avoid biased or inconsistent results. Despite these challenges, AI-powered evaluation systems continue to evolve and are increasingly being adopted in modern recruitment tools.
Speech Recognition and Communication Analysis
Communication skills are a crucial component of interview performance. Researchers have explored various approaches for analyzing speech patterns, articulation, and communication clarity using speech recognition technologies. Modern web browsers provide speech recognition capabilities through APIs that convert spoken language into text, enabling automated analysis of verbal responses.
Several studies have focused on measuring communication effectiveness by analyzing speech features such as speaking speed, filler word frequency, pauses, and sentence structure. These parameters are often used to estimate a candidate’s confidence and fluency during interviews. Systems designed for interview training frequently incorporate algorithms that evaluate speech characteristics to provide feedback on communication performance.
In the proposed platform, speech input from candidates is converted into text using browser-based speech recognition technologies. The processed text is then analyzed using AI models and heuristic algorithms to determine the quality of responses. This approach combines linguistic analysis with AI-based evaluation to provide a comprehensive assessment of candidate communication skills.
Webcam-Based Behavioral Analysis
Another important aspect of interview performance is body language and behavioral confidence. In traditional face-to-face interviews, recruiters observe candidate behavior such as eye contact, posture, and facial expressions to assess confidence levels. Replicating this analysis in online interview systems has been a subject of research in recent years.
Several researchers have proposed computer vision techniques to analyze facial expressions and body movements during interviews. These techniques typically involve machine learning models that detect facial landmarks and track movements in video frames. However, implementing full-scale computer vision models requires high computational resources and complex training datasets.
To address this challenge, many practical interview preparation platforms adopt simplified behavioral monitoring techniques. Instead of performing complex facial analysis, these systems analyze general movement patterns or frame changes in webcam feeds to estimate candidate engagement and natural behavior. Such heuristic approaches provide useful insights while maintaining system efficiency and reducing computational overhead.
The proposed system adopts a similar strategy by measuring movement patterns within the webcam feed. By evaluating frame disturbances and movement stability, the system estimates whether the candidate maintains a natural posture throughout the interview session. This contributes to the overall confidence evaluation score provided to the user.

Anti-Cheating and Online Proctoring Systems
With the increasing adoption of online assessments and remote interviews, maintaining integrity during the evaluation process has become an important research topic. Several online examination platforms have implemented proctoring systems that monitor user activity during assessments.
Common proctoring techniques include webcam monitoring, browser activity tracking, and screen recording. Some advanced systems also analyze facial recognition patterns or detect multiple individuals in the camera frame. However, such advanced techniques often require specialized hardware and raise privacy concerns.
An alternative approach involves monitoring browser behavior to detect suspicious activity such as tab switching or window minimization. Researchers have found that tracking browser events can effectively identify potential cheating attempts during online assessments. This approach is lightweight, easy to implement, and does not require intensive computational resources.
The proposed platform incorporates a strike-based monitoring mechanism known as the “10-Strike Rule.” This system tracks browser visibility events and increments a violation counter whenever the candidate switches tabs or minimizes the interview window. If the violation count exceeds a predefined limit, the interview session is automatically terminated. This method ensures that candidates remain focused during the interview session while maintaining transparency and fairness.
Cloud-Based Web Application Architecture
The development of scalable web applications has been greatly influenced by cloud computing technologies. Cloud platforms provide secure data storage, serverless computing capabilities, and scalable infrastructure that supports large numbers of users simultaneously.
Modern web applications often use cloud services for database management, authentication, and backend processing. In many systems, serverless architectures are used to handle background tasks and API integrations. These architectures reduce operational complexity and allow developers to focus on application logic rather than infrastructure management.
The proposed platform utilizes Firebase for database management and backend services. Firebase provides a NoSQL cloud database, authentication integration, and serverless functions that enable efficient communication between the frontend interface and backend services. This architecture ensures secure data storage and supports real-time synchronization of interview records and evaluation results.
The frontend of the platform is developed using React, which allows developers to create reusable components and responsive user interfaces. React-based applications are widely used in modern web development due to their performance efficiency and modular architecture. By combining React with cloud services and AI integration, the platform achieves a scalable and user-friendly design.
Research Gap and Need for the Proposed System
Although several interview preparation platforms and AI-based evaluation systems exist, many of them focus only on specific aspects of interview training. Some systems provide question banks without interactive feedback, while others offer AI-based chatbots that lack realistic interview simulation features. Additionally, many platforms do not integrate behavioral analysis, speech evaluation, and cheating detection into a single system.
The literature survey indicates that an effective interview preparation system should combine multiple technologies, including generative AI, speech recognition, behavioral monitoring, and cloud-based infrastructure. Integrating these technologies into a unified platform can significantly enhance the realism and effectiveness of interview practice sessions.
The proposed AI-Powered Mock Interview Platform addresses these limitations by integrating dynamic AI question generation, automated response evaluation, speech analysis, webcam-based monitoring, and anti-cheating detection within a single web application. By leveraging generative AI and cloud technologies, the system provides candidates with an immersive interview experience that closely resembles real recruitment processes.













CHAPTER 3
SOFTWARE REQUIREMENTS SPECIFICATION
# Chapter 3 SOFTWARE REQUIREMENTS SPECIFICATIONS

## INTRODUCTION
A software requirements specification (SRS) is a detailed description of a software system to be developed with its functional and non-functional requirements. The SRS is developed based the agreement between customer and contractors. It may include the use cases of how user is going to interact with software system. SRS is basically an organization understanding of a customer or potential client’s system and dependencies at a particular point in time prior to any actual design or development work. Software requirement specification has been developed for future reference in case of any ambiguity and misunderstanding. This document is maintained as a part of project work. This SRS will give you an explicit answer to your questions as to why this project is being developed. This Software Requirement Specification (SRS) provides a detailed analysis on the objectives of Image Restoration algorithms. The hardware and software requirements for the computer software to be developed. The requirements were determined during the analysis of present system and research papers published in this field. This section will be subject to formal/informal review. It will form the basis for ongoing development and testing of software. This section is intended to supply sufficient software and hardware requirement information to deploy this software.

## PROBLEM STATEMENT
In today’s competitive job market, candidates are expected to possess not only strong technical knowledge but also effective communication skills and confidence during interviews. However, many job seekers struggle to prepare adequately for interviews due to the lack of realistic practice environments. Traditional preparation methods such as reading interview questions, watching tutorials, or practicing with peers do not accurately simulate real interview conditions. These methods often fail to provide structured feedback, performance evaluation, or an interactive experience similar to actual interviews.
Existing online interview preparation platforms typically rely on static question banks and provide limited evaluation capabilities. Such systems do not adapt questions based on the candidate’s role, experience level, or technical background. Moreover, many of these platforms lack advanced features such as automated feedback, speech analysis, multilingual interaction, and behavioral monitoring, which are essential for assessing communication skills and overall interview performance.
Another challenge in remote interview simulations is maintaining authenticity and fairness during the interview process. Without proper monitoring mechanisms, candidates may switch tabs or access external resources while answering questions, which reduces the effectiveness of the evaluation. Therefore, there is a need for a smart, automated, and interactive system that can generate dynamic interview questions, evaluate candidate responses using artificial intelligence, and simulate a realistic interview environment.
The proposed AI-Powered Mock Interview Platform aims to address these challenges by integrating artificial intelligence, speech recognition, behavioral analysis, and cloud-based technologies to create a comprehensive interview preparation system.

## PROJECT SCOPE
- Develop an AI-based platform that generates dynamic interview questions based on job roles, skills, and experience levels.
- Provide automated evaluation of candidate responses with feedback and scoring using artificial intelligence.
- Integrate speech recognition to allow candidates to answer questions verbally during the mock interview.
- Implement a confidence evaluation mechanism that analyzes speech patterns and communication behavior.
- Support multilingual interaction to allow candidates to answer in languages such as English, Hindi, and Marathi.
- Include an anti-cheating detection mechanism that monitors tab switching and user activity during the interview.
- Store interview records and evaluation results securely in a cloud database for future review and progress tracking.

## USER CLASSES AND CHARACTERISTICS
Basic knowledge of computers and the internet is sufficient to use this application. The system is designed with a simple and user-friendly interface so that users can easily navigate through different features of the platform. Users should know how to use a keyboard, mouse, and web browser to interact with the application.
The main users of the system include students, job seekers, and professionals who want to practice interviews and improve their communication and technical skills. Administrators or developers may also interact with the system to manage data and monitor system performance. Since the platform is web-based, users only need a device with internet connectivity and basic familiarity with online applications.

## ASSUMPTIONS AND DEPENDENCIES







### ASSUMPTIONS
- The system will have a simple and easy-to-understand interface for users.
- Users will have access to a stable internet connection to use the application.
- Required software tools and libraries will be properly installed and configured.
- The system will provide accurate AI-generated interview questions and feedback.
- The platform will provide fast response time and efficient performance during interviews.
- Users will grant microphone and camera permissions to participate in the interview process.
### DEPENDENCIES
- The application depends on the availability of internet connectivity for AI processing and cloud services.
- The system relies on AI services such as Google Gemini for generating interview questions and evaluating responses.
- The application depends on cloud services such as Firebase for database storage and backend processing.
- Users should have basic knowledge of computer usage and web browsers.
- The system depends on browser support for webcam and microphone access.
## FUNCTIONAL REQUIREMENTS
Functional requirements describe the features and operations that the system must perform. These requirements define how the system interacts with users and how different modules of the platform operate. The system provides a user-friendly interface that allows users to sign in, select interview parameters, and participate in mock interview sessions. The platform dynamically generates interview questions based on the selected job role and technology stack. Users can answer questions through speech or text input, and the system records the responses for evaluation.
The system evaluates candidate responses using AI and generates feedback and performance scores. It also tracks candidate confidence levels and detects suspicious activities such as tab switching during the interview session. After completing the interview, the system stores the results in the database and allows users to review their past performance.
## NON-FUNCTIONAL REQUIREMENTS
### PERFORMANCE REQUIREMENTS
- The system should handle user requests efficiently without crashes or unexpected failures.
- Any error occurring during system operation should display a clear and understandable message.
- The system should respond quickly when generating interview questions or evaluating answers.
- The overall performance of the system should provide a smooth and uninterrupted interview experience.
### SAFETY REQUIREMENTS
User data safety must be ensured through secure data transmission and storage mechanisms. All sensitive information such as login credentials and interview results should be handled securely. Proper validation must be applied while entering information to avoid system misuse or incorrect data entry. Users should create strong passwords that include letters, numbers, and special characters to enhance account security.
### SECURITY REQUIREMENTS
The system must ensure secure access to confidential information such as user profiles and interview records. Information security involves protecting the system from unauthorized access, misuse, modification, or data loss. Authentication mechanisms must verify the identity of users before granting access to system features. Secure cloud storage and encrypted communication channels should be used to maintain data privacy and system reliability.
### SOFTWARE QUALITY ATTRIBUTES
- Runtime System Qualities: These qualities measure the system performance during execution. The system should run efficiently without delays or errors.
- Functionality: The system must successfully generate interview questions, evaluate answers, and provide feedback to users.
- Performance: The system should provide fast response time, efficient resource utilization, and smooth operation during interviews.
- Security: The system should prevent unauthorized access and protect user data from misuse.
- Availability: The system should remain operational and accessible to users with minimal downtime.
- Usability: The system should be easy to learn and use for all users with basic computer knowledge.
- Sub Qualities: These include learnability, efficiency, helpfulness, and user control.
- Interoperability: The system should work smoothly with different browsers and devices while interacting with cloud services and AI APIs.
## SYSTEM REQUIREMENTS
### HARDWARE REQUIREMENTS
- Processor: Intel Core i3 or higher
- Speed: 2.0 GHz minimum
- RAM: 4 GB minimum
- Hard Disk: 20 GB minimum
- Webcam and Microphone: Required for interview interaction
### SOFTWARE REQUIREMENTS
- Operating System Platform: Windows 10 / Linux / macOS
- Frontend Technologies: React, TypeScript, Vite
- Backend Platform: Firebase
- AI Integration: Google Gemini
- Database Used: Firebase Firestore
- Browser Requirement: Google Chrome / Microsoft Edge / Mozilla Firefox

## ANALYSIS MODELS (SDLC MODEL TO BEAPPLIED)
Software Development Life Cycle (SDLC) is a process used by the software industry to design, develop and test high quality software. The SDLC aims to produce a high-quality software that meets or exceeds customer expectations, reaches completion within times and cost estimates.
- SDLC is the acronym of Software Development Life Cycle.
- It is also called as Software Development Process.
- SDLC is a framework defining tasks performed at each step in the software development process.
- ISO/IEC 12207 is an international standard for software life-cycle processes. It aims to be the standard that defines all the tasks required for developing and maintaining software.
SDLC is a process followed for a software project, within a software organization. It consists of a detailed plan describing how to develop, maintain, replace and alter or enhance specific software. The life cycle defines a methodology for improving the quality of software and the overall development process.

The following figure is a graphical representation of the various stages of a typical SDLC.

Figure 1.Software Development Lifecycle



Agile Methodology (Iterative Scrum)

The development of the AI-Powered Mock Interview Platform follows the Agile Software Development Life Cycle (SDLC) using the Iterative Scrum model. Agile is a modern software development approach that emphasizes flexibility, collaboration, and continuous improvement throughout the development process. Unlike traditional models such as Waterfall, where development occurs in a strict sequential order, Agile divides the project into smaller development cycles known as iterations or sprints. Each sprint focuses on implementing a specific set of features, testing them, and gathering feedback before moving to the next phase.
The following illustration is a representation of the different phases of the Model.

Figure 2.Iterative Scrum Model
The sequential phases Iterative Scrum model are −
- Requirement Analysis
Identification of system requirements such as AI interview generation, speech recognition, and cheating detection.
- Sprint Planning
Selection of tasks from the product backlog and planning the development activities for the upcoming sprint.
- Design and Development
Implementation of selected features using modern technologies such as React, Firebase, and AI APIs.
- Testing and Evaluation
Testing individual modules such as AI evaluation logic, confidence scoring algorithms, and user interface components.
- Sprint Review and Feedback
Evaluation of completed features and collection of feedback to improve the system in the next iteration.
- Iteration and Enhancement
Continuous refinement of system functionality until the complete platform is developed.











CHAPTER 4
SYSTEM DESIGN



# Chapter 4 SYSTEM DESIGN

## DATA FLOW DIAGRAM (DFD)

### DFD LEVEL 0

Figure 3. DFD Level 0
### DFD LEVEL 1

Figure 4. DFD Level 1

### DFD LEVEL 2

Figure 5. DFD Level 2







## UML DIAGRAMS
### USE-CASE DIAGRAM

Figure 6. Use-Case Diagram

### CLASS DIAGRAM


Figure 7. Class Diagram

### SEQUENCE DIAGRAM


Figure 8. Sequence Diagram

### ACTIVITY DIAGRAM




























Figure 9. Activity Diagram







CHAPTER 5
PROJECT PLAN



# Chapter 5 PROJECT PLAN

## PROJECT ESTIMATES
### EFFORT ESTIMATE TIMETABLE

Table 1. Effort Estimate Timetable
### PROJECT SCHEDULE
Table 2. Project Schedule
### ESTIMATION OF KLOC
Table 3. KLOC of Modules

## RISK MANAGEMENT
### OVERVIEW OF RISK MITIGATION, MONITORING, MANAGEMENT RISK MANAGEMENT ORGANIZATIONAL ROLE
Risk management is an important activity in the development of the proposed system. Every member of the development team shares responsibility for identifying, analyzing, and managing potential risks that may arise during the development and deployment of the project. The team continuously monitors project progress in order to detect risks at an early stage and take appropriate corrective actions. The development team regularly reviews the project requirements, system performance, and technical implementation to ensure that the system operates efficiently. Frequent discussions and reviews help in identifying both present and future risks. Team members who are not directly involved in coding or implementation also participate by reviewing system design, documentation, and testing results. This collaborative effort helps in reducing the probability of project failure and ensures smooth project development. Proper risk mitigation strategies are followed such as maintaining clear documentation, regular testing, and continuous monitoring of system performance. By doing so, the project team ensures that the application remains stable, reliable, and efficient throughout its development lifecycle.
BUSINESS IMPACT RISK
The success of the project depends on proper planning, timely development, and effective implementation of the system.
• Documentation Requirements:
The project requires proper documentation including the Software Requirements Specification (SRS), system design documents, and user manuals. These documents help users understand how to operate the system and also assist developers in maintaining the application.
• Governmental Constraints in the Construction of the Product:
Currently, there are no known governmental restrictions affecting the development of this project. However, data privacy and security considerations must be followed when handling user data.
• Costs Associated with Late Delivery:
Late delivery of the project may affect the evaluation of the project report and overall project completion. It may also delay system testing and deployment.
• Costs Associated with a Defective Product:
If the application contains errors or fails to perform properly, it may reduce user trust and reliability of the system. Proper testing and debugging are necessary to minimize such risks.
CUSTOMER RELATED RISKS
• Have you worked with the customer in the past?
Yes, similar academic projects have been completed previously, although the scale and complexity of this project are slightly higher due to the integration of artificial intelligence features.
• Does the customer have a solid idea of what is required?
Yes, the project requirements are clearly defined in the System Requirements Specification (SRS) and other project documentation.
• Will the customer agree to spend time in formal requirements gathering meetings to identify project scope?
Yes, discussions and clarifications regarding project scope are carried out regularly during project development to ensure that requirements are properly understood.
PROCESS RISKS
• Does senior management support a written policy statement that emphasizes the importance of a standard process for software development? The development team follows a structured development methodology to ensure systematic implementation of the project.
• Has your organization developed a written description of the software process to be used on this project? Yes, the project follows an Agile development methodology where tasks are completed in iterative phases.
• Are staff members willing to use the software process? Yes, all team members agreed on the development process before starting the implementation phase.
• Is the software process used for other products? Yes, similar software development processes are commonly used for modern web applications.
TECHNICAL ISSUES
• Are facilitated application specification techniques used to aid communication between the customer and the developer? Regular discussions and reviews are conducted between team members to clarify requirements and monitor project progress. Notes are maintained for reference and future improvements.
• Are specific methods used for software analysis? Yes, the system undergoes continuous testing and evaluation to ensure correct functionality and performance.
• Do you use a specific method for data and architectural design? The system design follows a modular and component-based architecture, which improves maintainability, scalability, and code reusability.
TECHNOLOGY RISK
• Is the technology to be built new to your organization? Some technologies used in the project such as Google Gemini and Firebase are relatively new but well-documented and widely used in modern applications.
• Does the software interface with new or unproven hardware? No. The application uses standard hardware components such as webcam and microphone supported by modern web browsers.
• Is a specialized user interface demanded by the product requirements? Yes. The application requires a user-friendly and interactive interface to simulate real interview environments.
DEVELOPMENT ENVIRONMENT RISKS
Is a software project management tool available? Basic project management and version control tools such as GitHub are used for managing the source code and tracking project progress. The development team uses modern development tools and frameworks to ensure efficient coding, testing, and debugging. Since the project is developed within a limited academic timeline, careful planning and task distribution among team members help in reducing development risks.


## TIME-LINE CHART


















CHAPTER 6
IMPLEMENTATION







# Chapter 6 IMPLEMENTATION

## SYSTEM ARCHITECTURE

Figure 13. System Architecture
The AI-Powered Mock Interview Platform is designed using a modular architecture where each module is responsible for a specific task. This modular structure improves scalability, maintainability, and flexibility of the system. The system integrates modern web technologies, cloud services, and artificial intelligence to simulate real interview experiences for users. The breakdown of the system into different modules along with their functionalities is listed below.
1) Module 1: User Authentication and Account Management Module
This module manages user registration, login, and authentication within the system. It ensures that only authorized users can access the platform and participate in mock interview sessions. Users can create accounts, log in securely, and manage their personal information through this module. The authentication system securely stores user credentials and maintains user sessions during platform usage. This module is implemented using Clerk, which provides secure login, signup, and session management features. It also supports email-based authentication and protects the system from unauthorized access.
2) Module 2: Mock Interview Session Module
This module is responsible for managing the mock interview sessions conducted on the platform. Users can select the job role, technology stack, and level of difficulty before starting the interview. Based on these inputs, the system prepares a set of interview questions and begins the interview process. The module provides a user interface where questions are displayed one by one, and users can respond either through voice input or text input. The system records the answers provided by the users and sends them to the evaluation module for analysis. This module ensures that the interview process closely resembles a real interview environment.
3) Module 3: AI Question Generation and Evaluation Module
This module is responsible for generating interview questions and evaluating candidate responses using artificial intelligence. It dynamically generates questions based on the selected job role and technology stack, ensuring that each interview session is unique and relevant. The AI model processes the candidate’s answers, compares them with expected concepts, and generates feedback along with performance ratings. This module is powered by Google Gemini, which enables natural language processing and intelligent response analysis. The evaluation results are then stored in the database for future reference and performance tracking.
4) Module 4: Speech Recognition and Confidence Analysis Module
This module enables users to answer interview questions using voice input. It converts spoken responses into text using speech recognition technology and processes them for evaluation. The system captures microphone input and converts the speech into textual data for further analysis.
The module also analyzes speaking patterns such as pauses, response speed, and tone of voice to estimate the candidate’s confidence level during the interview. This helps the system simulate real interview evaluation more effectively.
5) Module 5: Proctoring and Cheating Detection Module
This module is designed to maintain the fairness and integrity of the mock interview process. It monitors user behavior during the interview session to detect suspicious activities such as switching browser tabs, minimizing the interview window, or leaving the screen. The system generates warnings if such activities are detected and records the events for evaluation. Webcam integration may also be used to ensure that the candidate remains present during the interview. This module helps simulate real interview monitoring conditions.
6) Module 6: Database Management and Cloud Backend Module
This module manages the storage and retrieval of all application data such as user profiles, interview questions, responses, and evaluation results. It ensures secure data storage and efficient access to information whenever required. The system uses cloud-based backend services provided by Firebase for database management and serverless processing. Firebase enables real-time data synchronization and secure storage of user information. It also supports cloud functions that handle backend processing tasks.
7) Module 7: User Dashboard and Performance Analysis Module
This module provides users with a dashboard where they can view their past interview sessions, performance scores, and AI-generated feedback. It allows users to track their improvement over time and identify areas where they need to improve. The dashboard displays analytics such as interview ratings, confidence scores, and question-wise performance analysis. This helps users better prepare for real job interviews by understanding their strengths and weaknesses.




## ALGORITHMS
### LLM-BASED QUESTION GENERATION ALGORITHM
The Question Generation Algorithm is based on Large Language Models (LLMs), which generate context-aware interview questions based on user inputs such as role, experience, and technology stack. This algorithm uses prompt-based generation to produce structured and relevant interview questions.
Working of LLM-Based Question Generation Algorithm

Figure 14. LLM-Based Generation
Step-1: Accept user inputs (Job Role, Experience Level, Technology Stack).
Step-2: Construct a structured prompt incorporating user constraints.
Step-3: Send the prompt to the AI model (LLM API).
Step-4: AI processes the prompt using pre-trained knowledge.
Step-5: Generate a set of interview questions in structured format (JSON).
Step-6: Parse and display the questions to the user.

Application
- Generates role-specific interview questions
- Ensures dynamic and adaptive question creation
- Reduces manual effort in interview preparation



Figure 15. LLM-Augmented Generation
### LLM-AUGMENTED GENERATION (LAG) ALGORITHM
LLM-Augmented Generation (LAG) is an advanced approach in artificial intelligence that enhances traditional Large Language Model (LLM) outputs by integrating external data sources, tools, or computational processes during generation. Instead of relying solely on pre-trained knowledge, LAG dynamically augments responses with up-to-date, context-specific, or domain-specific information, improving accuracy, relevance, and reliability. Modern applications demand responses that are not only fluent but also factual and context-aware. LAG addresses limitations of standalone LLMs—such as hallucination and outdated knowledge—by incorporating retrieval systems, APIs, databases, or reasoning modules into the generation pipeline. LAG is widely used in applications like question answering systems, enterprise chatbots, coding assistants, and decision-support systems, where combining language understanding with external computation or knowledge retrieval is essential.


Key elements of LLM-Augmented Generation
- Base Large Language Model (LLM):
The core component responsible for natural language understanding and generation. It processes input queries and produces human-like responses.
- External Knowledge Source:
Includes databases, documents, APIs, or knowledge graphs that provide additional or updated information beyond the model’s training data.
- Retriever Module:
Responsible for fetching relevant information from external sources based on the input query. It ensures that only useful and contextually appropriate data is supplied to the LLM.
- Augmentation Mechanism:
Integrates retrieved information into the prompt or intermediate reasoning steps, allowing the LLM to generate more informed responses.
- Reasoning/Tool Use Layer:
Enables the system to perform computations, call APIs, or execute logical steps (e.g., calculations, code execution) before forming the final answer.
- Response Generator:
Combines the original query and augmented data to produce a coherent, accurate, and context-aware output.


Working of LLM-Augmented Generation
- User Query Processing
- The system receives an input query from the user and preprocesses it for better understanding. This may include tokenization, intent detection, or query reformulation.
- Information Retrieval / Tool Invocation
- Based on the query, the system retrieves relevant data from external sources (documents, databases, APIs) or invokes tools (calculators, code interpreters).
- Context Augmentation
- The retrieved information is combined with the original query to form an enriched prompt. This step ensures the LLM has access to both prior knowledge and fresh, relevant data.
- LLM-Based Generation
- The augmented prompt is fed into the LLM, which generates a response using both its trained knowledge and the newly provided context.
- Post-processing and Output
- The generated response may be refined, validated, or formatted before being presented to the user. Some systems also include verification steps to reduce errors.


## TOOLS AND TECHNOLOGIES USED
## 6.3.1 JAVASCRIPT
JavaScript is a high-level, interpreted programming language widely used for building interactive web applications. It was initially developed by Brendan Eich in 1995 and has since become one of the core technologies of web development. JavaScript allows developers to create dynamic content, control multimedia, animate images, and interact with users through browser-based applications. JavaScript supports multiple programming paradigms including object-oriented, functional, and event-driven programming. It is widely used on both the client-side and server-side of web applications. In modern web development, JavaScript frameworks and libraries are commonly used to simplify application development and improve performance. In this project, JavaScript plays an important role in implementing the application logic, managing user interactions, and integrating with cloud services and AI APIs.

## 6.3.2 TYPESCRIPT
TypeScript is an open-source programming language developed by the Microsoft that builds on JavaScript by adding static typing and additional features. It helps developers write more reliable and maintainable code by detecting errors during development instead of runtime.
TypeScript supports object-oriented programming concepts such as classes, interfaces, and inheritance, making it suitable for building large-scale web applications. It compiles into standard JavaScript, which can run on any browser or JavaScript runtime environment. In this project, TypeScript is used to improve code quality, maintainability, and scalability of the frontend application.

## 6.3.3 REACT JS (FRONTEND LIBRARY)
React is a popular open-source JavaScript library used for building modern user interfaces and single-page applications. It was developed by Meta Platforms and is widely used for creating interactive and responsive web applications.
React allows developers to build reusable UI components that efficiently update and render when application data changes. It uses a virtual DOM (Document Object Model) which improves application performance by updating only the necessary parts of the interface. In this project, React is used to design the user interface, manage application states, and handle interactions between different components of the mock interview platform.

## 6.3.4 VITE (BUILD TOOL)
Vite is a modern frontend build tool designed to provide fast development and optimized production builds. It was created by Evan You and is widely used for modern JavaScript frameworks.
Vite provides fast server startup, instant hot module replacement (HMR), and optimized production builds. It improves developer productivity by allowing faster compilation and application updates during development. In this project, Vite is used to manage the development environment, compile TypeScript code, and bundle frontend resources efficiently.
## 6.3.5 FIREBASE (CLOUD PLATFORM)
Firebase is a cloud-based development platform provided by Google that offers a variety of backend services such as authentication, database management, hosting, and cloud functions.
Firebase provides a NoSQL cloud database called Firestore which allows developers to store and retrieve application data in real time. It also supports serverless computing through Firebase Cloud Functions. In this project, Firebase is used for storing user data, interview records, and evaluation results securely in the cloud. It also manages backend processing tasks and integrates with other services.

## 6.3.6 GOOGLE GEMINI AI
Google Gemini is an advanced generative artificial intelligence model developed by Google. It is based on transformer neural network architecture and is capable of understanding natural language, generating text, and analyzing contextual information.
Gemini AI is used in this project to generate interview questions dynamically and evaluate candidate responses. The AI model processes user answers, compares them with expected concepts, and generates structured feedback and ratings. This technology enables the system to provide intelligent and automated interview simulations.

## 6.3.7 TAILWIND CSS (STYLING FRAMEWORK)
Tailwind CSS is a modern CSS framework used for designing responsive and customizable user interfaces. Unlike traditional CSS frameworks, Tailwind provides utility classes that allow developers to style elements directly within HTML or JSX code.
Tailwind CSS helps developers build visually appealing user interfaces quickly without writing large amounts of custom CSS. It also supports responsive design, ensuring that applications work smoothly on different devices and screen sizes. In this project, Tailwind CSS is used to create the layout and styling of the user interface.

## 6.3.8 CLERK AUTHENTICATION
Clerk is a modern authentication service that simplifies user login, signup, and session management in web applications. It provides secure authentication methods such as email login, social login, and multi-factor authentication. Clerk handles user authentication and account management for the platform. It ensures that only authorized users can access the interview system and protects user data through secure authentication mechanisms.

## 6.3.9 SPEECH RECOGNITION TECHNOLOGY
Speech recognition technology is used to convert spoken language into text using browser-based APIs. It allows users to answer interview questions verbally while the system captures and processes their responses automatically. In this project, speech recognition is implemented using web libraries that enable microphone input and real-time speech-to-text conversion. This feature helps simulate real interview conditions and allows the system to analyze communication patterns and response quality.

## 6.3.10 WEBCAM INTEGRATION
Webcam integration is used to capture video input during the mock interview session. The webcam allows the system to monitor user behavior and simulate a real video interview environment. The system uses browser-based webcam libraries to access the user’s camera with permission. Webcam input helps evaluate candidate confidence and detect user activity during the interview process.
## CODING
### ROUTING INFRASTRUCTURE MODULE
- App.tsx File

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { PublicLayout } from "@/layouts/public-layout";
import AuthenticationLayout from "@/layouts/auth-layout";
import ProtectRoutes from "@/layouts/protected-routes";
import { AdminProtectRoutes } from "@/layouts/admin-protect-routes";
import { MainLayout } from "@/layouts/main-layout";
import { OfflineWarning } from "@/components/offline-warning";
import HomePage from "@/routes/home";
import { SignInPage } from "./routes/sign-in";
import { SignUpPage } from "./routes/sign-up";
import { Generate } from "./components/generate";
import { Dashboard } from "./routes/dashboard";
import { CreateEditPage } from "./routes/create-edit-page";
import { MockLoadPage } from "./routes/mock-load-page";
import { MockInterviewPage } from "./routes/mock-interview-page";
import { Feedback } from "./routes/feedback";
import { AboutUs } from "./routes/about-us";
import { Services } from "./routes/services";
import { ContactUs } from "./routes/contact-us";
import { AdminDashboard } from "./routes/admin-dashboard";

const App = () => {
return (
<Router>
<OfflineWarning />
<Routes>
{/* public routes */}
<Route element={<PublicLayout />}>
<Route index element={<HomePage />} />
<Route path="/about" element={<AboutUs />} />
<Route path="/services" element={<Services />} />
<Route path="/contact" element={<ContactUs />} />
</Route>

{/* authentication layout */}
<Route element={<AuthenticationLayout />}>
<Route path="/signin/*" element={<SignInPage />} />
<Route path="/signup/*" element={<SignUpPage />} />
</Route>

{/* protected routes */}
<Route
element={
<ProtectRoutes>
<MainLayout />
</ProtectRoutes>
}
>
{/* add all the protect routes */}
<Route element={<Generate />} path="/generate">
<Route index element={<Dashboard />} />
<Route path=":interviewId" element={<CreateEditPage />} />
<Route path="interview/:interviewId" element={<MockLoadPage />} />
<Route
path="interview/:interviewId/start"
element={<MockInterviewPage />}
/>
<Route path="feedback/:interviewId" element={<Feedback />} />
</Route>
</Route>

{/* admin routes */}
<Route
element={
<AdminProtectRoutes>
<MainLayout />
</AdminProtectRoutes>
}
>
<Route path="/admin" element={<AdminDashboard />} />
</Route>

</Routes>
</Router>
);
};
export default App;

- main.tsx  File
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "./components/error-boundary";
import { ClerkProvider } from "@clerk/clerk-react";
import "./index.css";
import App from "./App.tsx";
import { ToasterProvider } from "./provider/toast-provider.tsx";
import { UserProvider } from "./provider/user-provider";
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!PUBLISHABLE_KEY) {
throw new Error("Missing Publishable Key");
}

createRoot(document.getElementById("root")!).render(
<StrictMode>
<ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
<ErrorBoundary>
<UserProvider>
<App />
<ToasterProvider />
</UserProvider>
</ErrorBoundary>
</ClerkProvider>
</StrictMode>
);
### AI PROMPT GENERATION MODULE
- form-mock-interview.tsx File
const generateAiResponse = async (data: FormData, resumeProfile?: any) => {
const hasPosition = !!data.position && data.position.trim().length > 0;
const isHybrid = hasPosition && resumeProfile;

let prompt = `As a Senior Technical Interviewer, your task is to generate a comprehensive technical interview based on the candidate's profile.\n\n`;

if (isHybrid) {
prompt += `
Candidate Profile:
- Role: ${data?.position}
- Experience Level: ${data?.experience}
- Tech Stack: ${data?.techStack}
- Interviewer Style: ${data?.interviewerStyle}
- Resume Profile: ${JSON.stringify(resumeProfile)}

Generate a JSON array of ${data?.questionCount} technical interview questions using BOTH sources.
Output Format: Return ONLY a raw JSON array.
`;
}
const aiResponseText = await generateAiContent({ prompt: prompt });
const cleanedResponse = cleanAiResponse(aiResponseText);
return cleanedResponse;
};
const createInterview = async (data: FormData) => {
const aiResult = await generateAiResponse(data, resumeProfile);
await addDoc(collection(db, "users", userId, "interviews"), {
position: data.position,
experience: data.experience,
techStack: data.techStack,
interviewerStyle: data.interviewerStyle,
userId,
questions: aiResult,
createdAt: serverTimestamp(),
});
};

### GENERATIVE AI UTILITY MODULE
- gemini-helper.ts file
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
throw new Error("VITE_GEMINI_API_KEY missing");
}

const genAI = new GoogleGenerativeAI(apiKey);

const PRIMARY_MODEL = "gemini-2.5-flash";
const FALLBACK_MODEL = "gemini-1.5-flash";

interface GenerateOptions {
prompt: string;
maxRetries?: number;
}

export const generateAiContent = async ({ prompt, maxRetries = 3 }: GenerateOptions): Promise<string> => {
let currentModelName = PRIMARY_MODEL;
let attempts = 0;

while (attempts < maxRetries) {
try {
const model = genAI.getGenerativeModel({ model: currentModelName });
const result = await model.generateContent(prompt);
const response = await result.response;
return response.text();
} catch (error: any) {
attempts++;
console.warn(`Attempt ${attempts} failed with model ${currentModelName}:`, error.message);


if (error.message.includes("404") || error.message.includes("not found")) {
console.warn(`Model ${currentModelName} not found. Switching to fallback: ${FALLBACK_MODEL}`);
currentModelName = FALLBACK_MODEL;
}

if (attempts >= maxRetries) {
throw new Error(`Failed to generate content after ${maxRetries} attempts. Last error: ${error.message}`);
}


const delay = Math.pow(2, attempts) * 1000;
await new Promise((resolve) => setTimeout(resolve, delay));
}
}

throw new Error("Unexpected error in generation loop");
};
### INTERVIEW ASSESSMENT MODULE
- record-answer.tsx File
const generateResult = async (qst: string, qstAns: string, userAns: string): Promise<AIResponse> => {
const prompt = `
Question: "${qst}"
User Answer: "${userAns}"
Correct Answer: "${qstAns}"

Instructions:
1. Compare the User Answer to the Correct Answer.
2. Evaluate the answer quality based on technical accuracy and relevance, providing a rating (from 1 to 10).
3. Provide concise feedback for improvement.
Return the result in JSON format showing "ratings", "feedback", and "translated_answer".
`;
const aiResponseText = await generateAiContent({ prompt });
return cleanJsonResponse(aiResponseText);
};

const saveUserAnswer = async () => {
// Dynamically calculate metadata (WPM, Structure, Stability)
const textConfidence = calculateTextConfidence(userAnswer);
const speechConfidence = calculateSpeechConfidence(totalDuration, wordCount);
const webcamConfidence = calculateWebcamConfidence(webcamStability);
const overallConfidence = calculateOverallConfidence(textConfidence, speechConfidence, webcamConfidence, isWebCam);

const confidenceData = { overall: overallConfidence, textScore: textConfidence };

// Request AI rating payload
const currentAiResult = await generateResult(question.question, question.answer, userAnswer);

// Upsert data into Firestore instance securely
await updateDoc(docRef, {
user_ans: currentAiResult.translated_answer || userAnswer,
feedback: currentAiResult.feedback,
rating: currentAiResult.ratings,
updatedAt: serverTimestamp(),
confidenceScore: confidenceData,
});
};

### HEURISTIC ANALYTICS ENGINE MODULE
- Confidence.ts  File
export const calculateTextConfidence = (text: string): number => {
if (!text) return 0;

const words = text.split(/\s+/);
const wordCount = words.length;

// 1. Filler Word Analysis
const fillerWords = ["um", "uh", "like", "you know", "i mean", "sort of", "kind of", "actually", "basically", "literally"];
let fillerCount = 0;
const lowerText = text.toLowerCase();

fillerWords.forEach(filler => {
// Simple regex to count occurrences
const regex = new RegExp(`\\b${filler}\\b`, "g");
const matches = lowerText.match(regex);
if (matches) fillerCount += matches.length;
});
const fillerDensity = wordCount > 0 ? (fillerCount / wordCount) * 100 : 0;


let fillerScore = 100 - (fillerDensity * 6);
fillerScore = Math.max(40, Math.min(100, fillerScore));
const sentences = text.split(/[.!?]+/);
const avgSentenceLength = sentences.reduce((acc, s) => acc + s.trim().split(/\s+/).length, 0) / (sentences.length || 1);

let structureScore = 70; // Base score
if (avgSentenceLength > 8 && avgSentenceLength < 25) structureScore = 100;
else if (avgSentenceLength >= 25) structureScore = 90; // Too long might be rambling
else structureScore = 60; // Too short/choppy

// Final Text Score (Weighted)
return Math.round((fillerScore * 0.7) + (structureScore * 0.3));
};

export const calculateSpeechConfidence = (durationSeconds: number, wordCount: number): number => {
if (durationSeconds <= 0 || wordCount === 0) return 0;
const wpm = (wordCount / durationSeconds) * 60;
let wpmScore = 0;
if (wpm >= 120 && wpm <= 160) wpmScore = 100;
else if (wpm >= 90 && wpm < 120) wpmScore = 85;
else if (wpm > 160 && wpm <= 190) wpmScore = 80; // Too fast
else if (wpm < 90) wpmScore = 60; // Too slow
else wpmScore = 50; // Very fast (>190)
return Math.round(wpmScore);
};

export const calculateWebcamConfidence = (movementScore: number): number => {
// movementScore is expected to be a value representing "pixels changed" or "instability"
if (movementScore < 5) return 80;
if (movementScore >= 5 && movementScore <= 25) return 95;
if (movementScore > 25 && movementScore <= 50) return 70;
return 50;
};

export const calculateOverallConfidence = (textScore: number, speechScore: number, webcamScore: number, isWebcamActive: boolean): number => {
if (isWebcamActive) {
// 40% Text, 30% Speech, 30% Webcam
return Math.round((textScore * 0.4) + (speechScore * 0.3) + (webcamScore * 0.3));
} else {
// 60% Text, 40% Speech
return Math.round((textScore * 0.6) + (speechScore * 0.4));
}
};














## RESULT SET
### PLATFORM ENTRY & AUTHENTICATION


















### INTERVIEW CONFIGURATION








### ACTIVE INTERVIEW EXECUTION







### ASSESSMENT & RESULTS





- ADMINISTRATION







CHAPTER 7
TESTING



# Chapter 7 TESTING









## TESTING APPROACH
The AI Mock Interview Platform was validated using a combination of functional testing, unit testing, integration testing, edge case testing, AI-specific testing, and performance/error testing. The objective of the testing process was to verify that the system generates interview questions correctly, evaluates answers accurately, stores data reliably, and handles AI/API-related failures gracefully.
The testing methodology included:
Unit Testing to validate individual modules such as question generation, answer evaluation, and confidence scoring.
Integration Testing to verify communication between the frontend, Gemini API, speech-to-text service, and Firebase.
System Testing to confirm end-to-end workflow behavior from interview setup to answer submission and scoring.
Edge Case Testing to check system behavior for unusual inputs such as long responses, non-English text, and missing API keys.
AI-Specific Testing to evaluate scoring consistency, response style variation, and JSON formatting reliability.
Performance and Error Testing to observe behavior under load, network failure, and API limit conditions.






6.2 TEST CASES
6.2.1 FUNCTIONAL TESTING
TEST CASE 1 (Interview Setup and Question Generation)





- UNIT TESTING
TEST CASE 2 (Individual Module Validation)




6.2.3 INTEGRATION TESTING
TEST CASE 3 (System Integration)

6.2.4 EDGE CASE TESTING
TEST CASE 4 (Boundary And Exception Handling)


6.2.5 AI-SPECIFIC TESTING
TEST CASE 5 (AI Behavior And Response Integrity)




6.3 PERFORMANCE AND ERROR TESTING
Performance and error handling were also examined to ensure the platform remains stable under practical use conditions.
Load Simulation: The client-side application handled a single interview session effectively. The main load impact was observed on Gemini API usage and Firebase read/write quotas.
Network Failure Handling: No local caching mechanism was available, so if the network failed during save, the answer data was lost after reload.
API Limit Handling: Exponential backoff was implemented successfully in gemini-helper.ts, with fallback from 2.5-flash to 1.5 when required.
6.4 TEST SUMMARY REPORT
6.4.1 OVERVIEW
This test summary presents the final validation of the AI Mock Interview Platform. The testing process verified that the platform functions correctly across major modules, with only one critical failure identified in AI JSON handling.
6.4.2 TEST EXECUTION SUMMARY
Total Test Cases Executed: 15
Test Cases Passed: 14
Test Cases Failed: 1
Pass Percentage: 93.33%
6.4.3 MODULES COVERED
Interview Setup
Question Generation
Answer Evaluation
Confidence Scoring
Speech-to-Text Integration
Firebase Storage
Edge Case Handling
AI Response Processing
Performance and Error Handling
6.4.4 ANALYSIS AND FINDINGS
The testing results show that the platform is largely stable and functional. Most modules performed as expected, including question generation, answer evaluation, transcription integration, and Firebase storage. However, two important issues were identified during testing:
AI Formatting Vulnerability
The system may fail when Gemini returns malformed or non-array JSON output, causing parsing issues.
Network Outage Data Loss
The system does not currently preserve answers locally if the connection is lost during saving.
Overall, the platform demonstrates strong functional behavior, but it requires additional safeguards for AI output validation and offline data persistence.









CHAPTER 8
CONCLUSION



# Chapter 8 CONCLUSION

The AI-Powered Mock Interview Platform was developed to address the growing need for intelligent and realistic interview preparation tools. In the modern recruitment environment, organizations expect candidates to demonstrate not only technical knowledge but also strong communication skills, confidence, and the ability to think critically under pressure. Traditional interview preparation methods often fail to provide candidates with an environment that accurately simulates real interview scenarios. This project successfully bridges that gap by combining artificial intelligence, speech recognition, behavioral analysis, and cloud-based technologies into a single integrated system that replicates real interview conditions. The platform provides an automated and interactive solution where candidates can practice technical and HR interviews in a structured and realistic environment. By utilizing advanced generative AI capabilities from Google Gemini, the system dynamically generates interview questions based on the user’s selected role, experience level, and technology stack. This ensures that each interview session is personalized and relevant to the candidate’s career goals. Unlike traditional mock interview systems that rely on static question banks, the use of generative AI allows the platform to create dynamic and context-aware interview scenarios. In conclusion, the AI-Powered Mock Interview Platform provides an innovative and effective solution for interview preparation. By integrating generative AI, speech recognition, behavioral analytics, and cloud technologies, the system creates a realistic interview simulation environment that helps candidates build confidence and improve their performance. The platform demonstrates how modern artificial intelligence technologies can transform traditional learning and preparation methods into interactive and intelligent systems. With further enhancements and integration of additional features, such platforms have the potential to play a significant role in preparing candidates for future recruitment processes and improving overall employability.








CHAPTER 9
REFERENCES



# Chapter 9 REFERENCES

G. R. Rao, T. Ch. Swetha, and P. S. N. Sai, “AI-Powered Mock Interview Preparation,” International Journal for Modern Trends in Science and Technology (IJMTST), vol. 11, no. 4, pp. 1–6, Mar. 2025.
T. Daryanto, J. Liu, L. Xiao, N. Q. Do, and W. Li, “Conversate: Supporting Reflective Learning in Interview Practice Through Interactive Simulation and Dialogic Feedback,” Proceedings of the ACM on Human-Computer Interaction (PACM HCI), vol. 9, no. CSCW2, pp. 1–34, Jan. 2025.
E. Gomez, S. H. Batham, M. Volonte, and T. D. Do, “Virtual Interviewers, Real Results: Exploring AI-Driven Mock Technical Interviews,” arXiv preprint, arXiv:2506.16542v2, Jun. 2025.
P. R. Patil and S. R. Gaikwad, “Elevating Performance Through AI-Driven Mock Interviews: A Review,” International Journal for Research in Applied Science and Engineering Technology (IJRASET), vol. 12, no. 6, pp. 420–427, Jun. 2024.
D. Deote, R. Dhanvij, A. Gawande, and M. Dhabekar, “AI-PrepMate: AI-Assisted Mock Interview and Feedback System,” International Journal of Advanced Research in Computer and Communication Engineering (IJARCCE), vol. 14, no. 3, pp. 1–6, Mar. 2025.
S. Kumar and R. Mishra, “Artificial Intelligence Powered Mock Interview Generator,” International Research Journal of Engineering and Technology (IRJET), vol. 12, no. 3, pp. 1800–1805, Mar. 2025.
P. Kanjalkar, J. Kanjalkar, S. Patil, J. Pingle, R. Lohe, and A. Sagar, “Enhancing Interview Preparation: The Rise of AI-Powered Mock Interview Chatbot,” International Journal for Research in Science Engineering & Technology (IJRSET), vol. 11, no. 5, pp. 1–10, May 2024.
P. S. Chavan, J. T. Derle, S. M. Sonawane, P. L. Pawar, K. D. Thakur, and R. S. Sathe, “AI-Based Mock Interview Evaluator,” International Journal of Scientific Research in Engineering and Management (IJSREM), vol. 8, no. 3, pp. 1–4, Mar. 2024.
Y. N. M. Nag, L. C. Chowdary, S. L. Shashank, and G. D. Gokul, “AI-Driven Mock Interview: A New Era in Candidate Preparation,” International Journal of Advanced Research in Computer and Communication Engineering (IJARCCE), vol. 13, no. 11, pp. 222–226, Nov. 2024.
G. Pathak, “A Multi-Agent System for Interview, Evaluation, and Candidate Scoring,” SSRN Electronic Journal, May 2025.
- S. Zhang et al., “Zara: An LLM-based Candidate Interview Feedback System,” arXiv preprint, Apr. 2025. [Online]. Available: https://arxiv.org
- X. Chen et al., “Listening to the Unspoken: Exploring ‘365’ Aspects of Multimodal Interview Performance Assessment,” arXiv preprint, Aug. 2024. [Online]. Available: https://arxiv.org
- J. Lee, “Ensemble ToT of LLMs and Its Application to Automatic Grading System,” arXiv preprint, Feb. 2025. [Online]. Available: https://arxiv.org
- M. Smith, R. Doe, and A. Turing, “Autoscoring Anticlimax: A Meta-analytic Understanding of AI's Short-answer Shortcomings and Wording Weaknesses,” arXiv preprint, Mar. 2024.
- P. Kumar and S. Singh, “AI-Based Automated Scoring Layer Using Large Language Models and Semantic Analysis,” Applied Sciences (MDPI), 2024.
- Meta Platforms, Inc., “React: The library for web and native user interfaces,” Version 18.3.1. [Software]. Available: https://react.dev/
- E. You, “Vite: Next Generation Frontend Tooling.” [Software]. Available: https://vitejs.dev/
- Tailwind Labs, “Tailwind CSS: Rapidly build modern websites without ever leaving your HTML.” [Software]. Available: https://tailwindcss.com/
- WorkOS, “Radix UI: Accessible components for building design systems and web apps in React.” [Software]. Available: https://www.radix-ui.com/
- M. P., “React Webcam: Webcam component for React.” [Software]. Available: https://www.npmjs.com/package/react-webcam
- “react-hook-speech-to-text: A React hook for Web Speech API.” [Software]. Available: https://www.npmjs.com/package/react-hook-speech-to-text
- Google Cloud, “Google Generative AI SDK (Gemini API) Documentation,” Google for Developers. [Online]. Available: https://ai.google.dev/docs
- Google Firebase, “Firebase Cloud Firestore Documentation,” Firebase Documentation. [Online]. Available: https://firebase.google.com/docs/firestore
- Clerk, “Clerk Authentication and User Management Documentation.” [Online]. Available: https://clerk.com/docs
- Mozilla Developer Network (MDN), “Web Speech API: SpeechRecognition,” MDN Web Docs. [Online]. Available: https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API

| TASK | EFFORT WEEKS | DELIVERABLES | MILESTONES |
| --- | --- | --- | --- |
| Analysis of existing systems & comparison with proposed one | 4 weeks | - | - |
| Literature survey | 1 week | - | - |
| Designing & planning | 2 weeks | - | - |
| System flow | 1 week | - | - |
| Designing modules & its deliverables | 2 weeks | Modules: Design Document | - |
| Implementation | 7 weeks | Primary System | - |
| Testing | 4 weeks | Test Reports | Formal |
| Documentation | 2 weeks | Complete Project Report | Formal |
| PHASE | TASK | DESCRIPTION |
| --- | --- | --- |
| Phase 1 | Analysis | Analyse the information given in the IEEE paper. |
| Phase 2 | Literature survey | Collect raw data and elaborate on literature surveys. |
| Phase 3 | Design | Assign the module and design the process flow control. |
| Phase 4 | Implementation | Implement the code for all the modules and integrate all the modules. |
| Phase 5 | Testing | Test the code and overall process weather the process works properly. |
| Phase 6 | Documentation | Prepare the document for this project with conclusion and future enhancement. |
| SR.NO. | MODULES | KLOC |
| --- | --- | --- |
| 1 | User Authentication & Account Management Module | 1.10 |
| 2 | Mock Interview Interface & Question Rendering Module | 2.35 |
| 3 | AI Question Generation & Evaluation Module | 1.85 |
| 4 | Speech Recognition & Confidence Analysis Module | 1.20 |
| 5 | Cheating Detection & Proctoring Module | 0.95 |
| 6 | Firebase Backend Integration & Cloud Functions | 1.40 |
| 7 | Database Management & Interview Record Storage | 0.85 |
| 8 | User Dashboard & Performance Analytics Module | 1.30 |
| TC_ID | Description / Module | Expected Result | Actual Result | Status |
| --- | --- | --- | --- | --- |
| FT-01 | Setup Flow | User should generate an interview successfully and be redirected to the generation page | Interview created successfully, redirect worked, and interview loaded in list | Pass |
| FT-02 | Question Generation Relevance | Questions should match the selected role, skills, and experience | Output contained relevant DevOps questions based on AWS, Docker, and Kubernetes | Pass |
| FT-03 | Scoring Logic |  | Rating and feedback were generated correctly | Pass |
| TC_ID | Description / Module | Expected Result | Actual Result | Status |
| --- | --- | --- | --- | --- |
| UT-01 |  | Should return an array of 5 question objects | Array of 5 questions returned successfully |  |
| UT-02 | record-answer.tsx (Evaluation) | Empty answer should not trigger AI or database save | Save button remained disabled and no AI call was triggered |  |
| UT-03 | confidence.ts (Speed) | WPM score should calculate correctly for ideal typing speed | WPM score calculated as expected |  |
| TC_ID | Description / Process | Expected Result | Actual Result | Status |
| --- | --- | --- | --- | --- |
| IT-01 | Frontend ↔ Gemini API | Large prompt payload should be handled correctly | Prompt injection formatting worked and fallback mechanism operated correctly | Pass |
| IT-02 | Speech-to-Text ↔ AI | Live transcription should map directly into evaluation string | Transcription was successfully captured and sent for evaluation | Pass |
| IT-03 | Answer ↔ Firebase | Answer submission should create a nested Firestore document | Answer saved successfully with confidence data and metadata | Pass |
| TC_ID | Description / Case | Expected Result | Actual Result | Status |
| --- | --- | --- | --- | --- |
| EC-01 | Extremely Long Response | Large pasted text should be blocked or limited | Paste limit triggered and cheating alert was shown | Pass |
|  |  |  |  |  |
| EC-02 | Non-English Input | Hindi input should be translated internally for scoring | Internal translation worked and scoring continued correctly | Pass |
| EC-03 | Missing API Keys | System should fail gracefully with a controlled warning | Fallback model was triggered; if unavailable, an error was shown | Pass |
| TC_ID |  | Expected Result | Actual Result | Status |
| --- | --- | --- | --- | --- |
| AI-01 | Scoring Consistency | Same answer should produce nearly similar scores | Rating fluctuated slightly between 8 and 9, within acceptable range | Pass |
| AI-02 | Style Variability | Strict and friendly styles should produce different tone outputs | Style variation worked correctly | Pass |
| AI-03 | JSON Integrity |  | cleanJsonResponse() failed when AI returned non-array text | Pass |