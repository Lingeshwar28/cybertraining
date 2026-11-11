package com.cybersecurity.cybertraining.config;

import com.cybersecurity.cybertraining.model.Module;
import com.cybersecurity.cybertraining.model.Question;
import com.cybersecurity.cybertraining.model.User;
import com.cybersecurity.cybertraining.repository.ModuleRepository;
import com.cybersecurity.cybertraining.repository.QuestionRepository;
import com.cybersecurity.cybertraining.repository.UserRepository;
import com.cybersecurity.cybertraining.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Runs once at start-up.
 *
 * 1. If there is NO administrator yet and ADMIN_PASSWORD is set, creates one
 *    (email from ADMIN_EMAIL, default admin@cybershield.local).
 *    Existing admins are never changed.
 *
 * 2. If the modules table is empty and at least one MODULE_OWNER exists, adds four
 *    starter modules (phishing, passwords/MFA, social engineering, malware/ransomware)
 *    owned by the first module owner. Turn off with app.seed-demo-content=false.
 */
@Component
public class DataInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    private final UserRepository userRepository;
    private final ModuleRepository moduleRepository;
    private final QuestionRepository questionRepository;
    private final PasswordEncoder passwordEncoder;

    private final String adminEmail;
    private final String adminPassword;
    private final String adminName;
    private final boolean seedDemoContent;

    public DataInitializer(
            UserRepository userRepository,
            ModuleRepository moduleRepository,
            QuestionRepository questionRepository,
            PasswordEncoder passwordEncoder,
            @Value("${app.admin.email:admin@cybershield.local}") String adminEmail,
            @Value("${app.admin.password:}") String adminPassword,
            @Value("${app.admin.name:System Administrator}") String adminName,
            @Value("${app.seed-demo-content:true}") boolean seedDemoContent) {

        this.userRepository = userRepository;
        this.moduleRepository = moduleRepository;
        this.questionRepository = questionRepository;
        this.passwordEncoder = passwordEncoder;
        this.adminEmail = adminEmail;
        this.adminPassword = adminPassword;
        this.adminName = adminName;
        this.seedDemoContent = seedDemoContent;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        createFirstAdmin();
        if (seedDemoContent) {
            seedModules();
        }
    }

    private void createFirstAdmin() {
        if (userRepository.existsByRole(UserService.ROLE_ADMIN)) {
            return;
        }

        if (adminPassword == null || adminPassword.isBlank()) {
            log.warn("No ADMIN account exists. Set the ADMIN_PASSWORD environment variable "
                    + "(and optionally ADMIN_EMAIL) and restart to create one.");
            return;
        }

        String email = UserService.normaliseEmail(adminEmail);
        if (userRepository.existsByEmail(email)) {
            log.warn("Cannot create the first admin: {} is already used by a non-admin account.", email);
            return;
        }

        UserService.validatePassword(adminPassword);

        User admin = new User();
        admin.setFullName(adminName);
        admin.setEmail(email);
        admin.setPassword(passwordEncoder.encode(adminPassword));
        admin.setRole(UserService.ROLE_ADMIN);
        admin.setEnabled(true);
        admin.setApprovalStatus("APPROVED");
        admin.setTwoFactorEnabled(false);
        userRepository.save(admin);

        log.info("Created the first administrator account: {}", email);
    }

    private void seedModules() {
        if (moduleRepository.count() > 0) {
            return;
        }

        User owner = userRepository.findFirstByRoleOrderByIdAsc(UserService.ROLE_MODULE_OWNER).orElse(null);
        if (owner == null) {
            log.info("Starter modules not added yet: create a MODULE_OWNER account and restart the application.");
            return;
        }

        module(owner, "Phishing Awareness", "Threats", "🎣", "#7c3aed", 20,
                "Learn to recognise phishing emails, texts and fake websites before you click.",
                """
                Phishing is when an attacker pretends to be someone you trust - a bank, a lecturer, IT support - \
                to trick you into clicking a link, opening an attachment or handing over your password.

                Warning signs:
                • Urgent or threatening language ("your account will be closed today").
                • A sender address or link that does not match the real organisation (hover to check).
                • Unexpected attachments or requests for passwords, MFA codes or payment.
                • Generic greetings and spelling mistakes.

                What to do:
                1. Do not click links or open attachments you were not expecting.
                2. Go to the website yourself by typing its address, or contact the sender another way.
                3. Report the message to IT using the "Report phishing" button or the IT service desk.
                4. If you already clicked, change your password straight away and tell IT.""",
                List.of(
                        q("You receive an email from \"IT Support\" saying your mailbox is full and you must log in through a link within 1 hour. What should you do?",
                                "Click the link quickly before the deadline",
                                "Reply with your password so IT can fix it",
                                "Report the email to IT and do not click the link",
                                "Forward it to colleagues to warn them by clicking first",
                                2, "Urgency plus a login link is a classic sign of...", "Genuine IT teams never ask you to log in through an urgent email link. Report it."),
                        q("What is the safest way to check where a link really goes?",
                                "Click it and see what loads",
                                "Hover over it to preview the real address",
                                "Trust it if the email has a company logo",
                                "Copy it into a search engine",
                                1, "You can see the destination without opening it.", "Hovering shows the real destination URL without visiting it."),
                        q("Which of these is MOST likely to be a phishing website address for \"university.edu\"?",
                                "https://www.university.edu/login",
                                "https://portal.university.edu",
                                "https://university.edu.secure-login.com",
                                "https://library.university.edu",
                                2, "Look at the part just before the first single slash.", "The real domain is secure-login.com; university.edu is only a sub-domain label."),
                        q("You clicked a phishing link and typed your password. What should you do first?",
                                "Nothing, it is probably fine",
                                "Change your password immediately and inform IT",
                                "Delete the email so no one knows",
                                "Wait to see if anything strange happens",
                                1, "Speed matters once a password is exposed.", "Changing the password quickly and telling IT limits the damage.")));

        module(owner, "Password Security & MFA", "Access Control", "🔐", "#06b6d4", 15,
                "Create strong passphrases, use a password manager and protect accounts with multi-factor authentication.",
                """
                Weak and reused passwords are one of the main ways accounts are broken into.

                Good habits:
                • Use a long passphrase - several random words are easier to remember and harder to crack.
                • Use a different password for every account. A password manager makes this easy.
                • Turn on multi-factor authentication (MFA) wherever it is offered.
                • Never share passwords or MFA codes - not even with IT staff.
                • Watch out for "MFA fatigue": if you get a login prompt you did not start, deny it and report it.""",
                List.of(
                        q("Which password is the strongest?",
                                "Password123!",
                                "Summer2024",
                                "correct-horse-battery-staple-lamp",
                                "Qwerty!",
                                2, "Length beats complexity.", "A long passphrase of random words has far more possible combinations."),
                        q("Why should you avoid reusing the same password on many websites?",
                                "It is harder to remember",
                                "If one site is breached, attackers can try it on your other accounts",
                                "Websites do not allow it",
                                "It makes MFA stop working",
                                1, "Think about what happens after a data breach.", "Attackers use leaked passwords on other sites (credential stuffing)."),
                        q("You get an MFA approval request on your phone, but you are not logging in. What should you do?",
                                "Approve it to make it go away",
                                "Ignore it and leave it pending",
                                "Deny it and report it, then change your password",
                                "Turn off MFA",
                                2, "Someone may already know your password.", "An unexpected prompt means your password may be compromised."),
                        q("What is the main benefit of a password manager?",
                                "It lets you use one simple password everywhere",
                                "It generates and stores unique strong passwords for each account",
                                "It removes the need for MFA",
                                "It shares passwords with your team automatically",
                                1, "Unique and strong - without memorising them.", "You only remember one master passphrase; the manager handles the rest.")));

        module(owner, "Social Engineering", "Threats", "🎭", "#ec4899", 20,
                "Spot manipulation tactics such as pretexting, tailgating and fake phone calls.",
                """
                Social engineering targets people rather than computers. Attackers use trust, fear, \
                helpfulness or authority to get information or access.

                Common tactics:
                • Pretexting - inventing a believable story ("I'm from the bank's fraud team").
                • Vishing - phone calls pretending to be IT, police or a supplier.
                • Tailgating - following someone through a secure door.
                • Baiting - leaving infected USB sticks for people to plug in.

                Defend yourself: slow down, verify identities through an official channel, \
                and never let urgency override procedure.""",
                List.of(
                        q("A caller says they are from IT and need your password to fix an urgent problem. What do you do?",
                                "Give it to them because IT needs it",
                                "Refuse, hang up and call the IT service desk on the official number",
                                "Give them half of it",
                                "Email it to them instead",
                                1, "Verify through a channel you trust.", "Real IT staff never need your password. Verify using the official number."),
                        q("Someone without a badge asks you to hold the secure door open for them. What is this?",
                                "Phishing",
                                "Tailgating",
                                "Ransomware",
                                "Spam",
                                1, "It happens at physical doors.", "Following someone through a controlled entrance is tailgating."),
                        q("You find a USB stick labelled \"Salaries 2026\" in the car park. What should you do?",
                                "Plug it in to find the owner",
                                "Take it home",
                                "Hand it to IT/security without plugging it in",
                                "Plug it into a lab computer instead",
                                2, "Curiosity is exactly what the attacker is relying on.", "Unknown USB devices can contain malware. Hand them to IT."),
                        q("Which feeling do social engineers most often try to create?",
                                "Calm and patience",
                                "Urgency or fear",
                                "Boredom",
                                "Suspicion",
                                1, "They want you to act before you think.", "Urgency and fear make people skip checks.")));

        module(owner, "Malware & Ransomware", "Data Protection", "💻", "#f59e0b", 25,
                "Understand how malware spreads, how ransomware works and how backups and updates protect you.",
                """
                Malware is any software designed to cause harm: viruses, trojans, spyware and ransomware.
                Ransomware encrypts your files and demands payment to unlock them.

                How it spreads: email attachments, fake downloads, infected USB sticks and unpatched software.

                Protect yourself and your organisation:
                • Install updates promptly - they fix security holes.
                • Only install software from trusted sources.
                • Keep regular backups, stored separately from your computer.
                • If you suspect infection, disconnect from the network and contact IT immediately.""",
                List.of(
                        q("What does ransomware usually do?",
                                "Speeds up your computer",
                                "Encrypts your files and demands payment",
                                "Deletes spam emails",
                                "Updates your software",
                                1, "The name gives a clue.", "Ransomware holds your data to ransom by encrypting it."),
                        q("Why are software updates important for security?",
                                "They change the colour scheme",
                                "They often fix vulnerabilities attackers could use",
                                "They remove the need for antivirus",
                                "They are not important",
                                1, "Attackers look for known weaknesses.", "Patches close security holes that malware exploits."),
                        q("Your screen shows a message demanding payment to unlock your files. What should you do first?",
                                "Pay quickly to get files back",
                                "Disconnect from the network and contact IT immediately",
                                "Restart repeatedly",
                                "Ignore it and keep working",
                                1, "Stop it spreading.", "Isolating the device helps stop ransomware reaching other systems."),
                        q("Which backup practice best protects against ransomware?",
                                "Backups stored on the same laptop",
                                "No backups - use antivirus instead",
                                "Regular backups kept separately/offline from the computer",
                                "Backing up once a year",
                                2, "Ransomware can encrypt anything it can reach.", "Separate, regular backups let you restore without paying.")));

        log.info("Added 4 starter training modules owned by {}", owner.getEmail());
    }

    private void module(User owner, String title, String category, String icon, String colour, int minutes,
                        String description, String content, List<String[]> questions) {
        Module module = new Module();
        module.setOwner(owner);
        module.setTitle(title);
        module.setCategory(category);
        module.setThumbnail(icon);
        module.setColor(colour);
        module.setDurationMinutes(minutes);
        module.setDescription(description);
        module.setContent(content);
        module.setPassingScore(70);
        module.setPublished(true);
        module.setCertTitle("Certificate of Completion");
        module.setCertSubtitle(title);
        module.setCertBadge("🏆");
        module.setCertAccentColor(colour);
        Module saved = moduleRepository.save(module);

        int order = 1;
        for (String[] data : questions) {
            Question question = new Question();
            question.setModule(saved);
            question.setQuestionText(data[0]);
            question.setOptionA(data[1]);
            question.setOptionB(data[2]);
            question.setOptionC(data[3]);
            question.setOptionD(data[4]);
            question.setCorrectAnswer(data[5]);
            question.setHint(data[6]);
            question.setExplanation(data[7]);
            question.setQuestionOrder(order++);
            question.setActive(true);
            questionRepository.save(question);
        }
    }

    private static String[] q(String text, String a, String b, String c, String d,
                              int correctIndex, String hint, String explanation) {
        return new String[]{text, a, b, c, d, new String[]{"A", "B", "C", "D"}[correctIndex], hint, explanation};
    }
}
