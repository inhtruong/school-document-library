import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
// env-core.ts, not "../src/lib/env" — the guarded wrapper imports
// "server-only", which a plain tsx script can't tolerate.
import { isProductionSeedBlocked } from "../src/lib/env-core";

const prisma = new PrismaClient();

/**
 * Development-only accounts. Passwords are intentionally simple and documented here
 * for local testing — never reuse these for a real account, and never commit real secrets.
 */
const devUsers = [
  { name: "Sam Student", email: "student@example.com", password: "student123", role: "STUDENT" as const },
  { name: "Tara Teacher", email: "teacher@example.com", password: "teacher123", role: "TEACHER" as const },
  { name: "Alex Admin", email: "admin@example.com", password: "admin123", role: "ADMIN" as const },
];

/**
 * Step 1 legacy documents — no taxonomy relation, classified only by the
 * free-text `subject` field. Kept exactly as before (Step 6A doesn't
 * migrate old records to the new taxonomy) so the "legacy document with no
 * taxonomy" rendering path stays testable. `documentType` values are the
 * new controlled enum, mapped 1:1 from what used to be free text here.
 */
const documents = [
  {
    title: "Database Final Exam 2025",
    description: "Final exam covering normalization, transactions, and query optimization.",
    subject: "Database",
    documentType: "EXAM" as const,
    academicYear: "2024-2025",
  },
  {
    title: "Database Midterm Exam 2024",
    description: "Midterm exam covering relational algebra and ER modeling.",
    subject: "Database",
    documentType: "EXAM" as const,
    academicYear: "2023-2024",
  },
  {
    title: "SQL Joins and Indexing Workbook",
    description: "Practice workbook on inner/outer joins and index strategy.",
    subject: "Database",
    documentType: "LECTURE" as const,
    academicYear: "2024-2025",
  },
  {
    title: "Data Structures Lecture Notes",
    description: "Lecture notes on arrays, linked lists, trees, and hash tables.",
    subject: "Data Structures",
    documentType: "LECTURE" as const,
    academicYear: "2024-2025",
  },
  {
    title: "Graphs and Shortest Paths Practice Set",
    description: "Assignment covering BFS, DFS, and Dijkstra's algorithm.",
    subject: "Data Structures",
    documentType: "EXERCISE" as const,
    academicYear: "2024-2025",
  },
  {
    title: "Big-O Complexity Cheatsheet",
    description: "Quick reference for common time and space complexity classes.",
    subject: "Data Structures",
    documentType: "REFERENCE" as const,
    academicYear: "2023-2024",
  },
  {
    title: "Web Development Assignment",
    description: "Build a responsive multi-page site using semantic HTML and CSS.",
    subject: "Web Development",
    documentType: "EXERCISE" as const,
    academicYear: "2024-2025",
  },
  {
    title: "React Hooks Cheatsheet",
    description: "Quick reference for useState, useEffect, useMemo, and useRef.",
    subject: "Web Development",
    documentType: "REFERENCE" as const,
    academicYear: "2024-2025",
  },
  {
    title: "Responsive Layout Lecture Notes",
    description: "Notes on flexbox, grid, and mobile-first design.",
    subject: "Web Development",
    documentType: "LECTURE" as const,
    academicYear: "2023-2024",
  },
  {
    title: "Computer Networks Cheatsheet",
    description: "Summary of the OSI model, TCP/IP stack, and common protocols.",
    subject: "Computer Networks",
    documentType: "REFERENCE" as const,
    academicYear: "2024-2025",
  },
  {
    title: "TCP/IP Layer Review Exam",
    description: "Exam covering the transport and network layers in depth.",
    subject: "Computer Networks",
    documentType: "EXAM" as const,
    academicYear: "2023-2024",
  },
  {
    title: "Subnetting Assignment",
    description: "Practice problems on IPv4 subnetting and CIDR notation.",
    subject: "Computer Networks",
    documentType: "EXERCISE" as const,
    academicYear: "2024-2025",
  },
];

/**
 * Step 6A education taxonomy — Grade → Subject → Lesson/Topic. Small on
 * purpose (enough to develop/verify cascading selection, not a national
 * curriculum). Upserted by natural key (never deleteMany + recreate) so
 * re-running the seed never orphans a Document's taxonomy links by handing
 * out fresh IDs for the same Grade/Subject/Lesson on every run.
 */
const taxonomy = [
  {
    code: "G10",
    name: "Grade 10",
    sortOrder: 10,
    subjects: [
      {
        code: "MATH",
        name: "Mathematics",
        lessons: [
          { code: "LINEAR_FUNCTIONS", name: "Linear Functions" },
          { code: "QUADRATIC_FUNCTIONS", name: "Quadratic Functions" },
        ],
      },
      {
        code: "PHYSICS",
        name: "Physics",
        lessons: [{ code: "MOTION", name: "Motion" }],
      },
    ],
  },
  {
    code: "G11",
    name: "Grade 11",
    sortOrder: 11,
    subjects: [
      {
        code: "MATH",
        name: "Mathematics",
        lessons: [
          { code: "TRIGONOMETRY", name: "Trigonometry" },
          { code: "SEQUENCES", name: "Sequences" },
        ],
      },
      {
        code: "PHYSICS",
        name: "Physics",
        lessons: [{ code: "ELECTRIC_FIELD", name: "Electric Field" }],
      },
    ],
  },
  {
    code: "G12",
    name: "Grade 12",
    sortOrder: 12,
    subjects: [
      {
        code: "MATH",
        name: "Mathematics",
        lessons: [
          { code: "DERIVATIVES", name: "Derivatives" },
          { code: "INTEGRALS", name: "Integrals" },
        ],
      },
      {
        code: "PHYSICS",
        name: "Physics",
        lessons: [{ code: "OSCILLATIONS", name: "Oscillations" }],
      },
    ],
  },
];

async function seedTaxonomy() {
  /** lessonId keyed by "gradeCode/subjectCode/lessonCode", for building taxonomy-backed sample documents below. */
  const lessonIds = new Map<string, string>();
  let gradeCount = 0;
  let subjectCount = 0;
  let lessonCount = 0;

  for (const gradeData of taxonomy) {
    const grade = await prisma.grade.upsert({
      where: { code: gradeData.code },
      update: { name: gradeData.name, sortOrder: gradeData.sortOrder },
      create: { code: gradeData.code, name: gradeData.name, sortOrder: gradeData.sortOrder },
    });
    gradeCount += 1;

    for (const subjectData of gradeData.subjects) {
      const subject = await prisma.subject.upsert({
        where: { gradeId_code: { gradeId: grade.id, code: subjectData.code } },
        update: { name: subjectData.name },
        create: { gradeId: grade.id, code: subjectData.code, name: subjectData.name },
      });
      subjectCount += 1;

      for (const lessonData of subjectData.lessons) {
        const lesson = await prisma.lesson.upsert({
          where: { subjectId_code: { subjectId: subject.id, code: lessonData.code } },
          update: { name: lessonData.name },
          create: { subjectId: subject.id, code: lessonData.code, name: lessonData.name },
        });
        lessonCount += 1;
        lessonIds.set(`${gradeData.code}/${subjectData.code}/${lessonData.code}`, lesson.id);
      }
    }
  }

  console.log(`Seeded taxonomy: ${gradeCount} grades, ${subjectCount} subjects, ${lessonCount} lessons.`);
  return lessonIds;
}

/**
 * A handful of new, taxonomy-backed sample documents (alongside the
 * untouched legacy ones above) so both the taxonomy and legacy rendering
 * paths are exercisable after seeding.
 */
async function seedTaxonomyDocuments(lessonIds: Map<string, string>) {
  const specs = [
    {
      lessonKey: "G10/MATH/LINEAR_FUNCTIONS",
      title: "Grade 10 Linear Functions Practice Set",
      description: "Practice problems on graphing and solving linear functions.",
      subjectName: "Mathematics",
      documentType: "EXERCISE" as const,
      academicYear: "2025-2026",
    },
    {
      lessonKey: "G11/PHYSICS/ELECTRIC_FIELD",
      title: "Grade 11 Electric Field Lecture Notes",
      description: "Lecture notes on electric field strength, field lines, and Coulomb's law.",
      subjectName: "Physics",
      documentType: "LECTURE" as const,
      academicYear: "2025-2026",
    },
    {
      lessonKey: "G12/MATH/DERIVATIVES",
      title: "Grade 12 Derivatives Exam",
      description: "Exam covering differentiation rules and applications of derivatives.",
      subjectName: "Mathematics",
      documentType: "EXAM" as const,
      academicYear: "2025-2026",
    },
    {
      lessonKey: "G12/PHYSICS/OSCILLATIONS",
      title: "Grade 12 Oscillations Reference Sheet",
      description: "Quick reference for simple harmonic motion formulas.",
      subjectName: "Physics",
      documentType: "REFERENCE" as const,
      academicYear: "2025-2026",
    },
  ];

  for (const spec of specs) {
    const [gradeCode, subjectCode] = spec.lessonKey.split("/");
    const lessonId = lessonIds.get(spec.lessonKey);
    if (!lessonId) throw new Error(`Seed error: no lesson id for ${spec.lessonKey}`);

    const grade = await prisma.grade.findUniqueOrThrow({ where: { code: gradeCode } });
    const subject = await prisma.subject.findUniqueOrThrow({
      where: { gradeId_code: { gradeId: grade.id, code: subjectCode } },
    });

    await prisma.document.create({
      data: {
        title: spec.title,
        description: spec.description,
        academicYear: spec.academicYear,
        documentType: spec.documentType,
        // Kept in sync with the taxonomy Subject's name — see uploadDocument().
        subject: spec.subjectName,
        gradeId: grade.id,
        subjectId: subject.id,
        lessonId,
      },
    });
  }

  console.log(`Seeded ${specs.length} taxonomy-backed documents.`);
}

async function main() {
  // Never let this run against production — it would wipe every Document/User
  // row and recreate demo accounts with well-known, publicly-documented
  // passwords. Use `npm run create-admin` for a production ADMIN account.
  if (isProductionSeedBlocked()) {
    console.error(
      "Refusing to run the development seed in production (NODE_ENV=production).\n" +
        "This seed deletes all Documents/Users and creates demo accounts with public, well-known passwords.\n" +
        "Use `npm run create-admin` to create your first production ADMIN account instead."
    );
    process.exitCode = 1;
    return;
  }

  await prisma.document.deleteMany();
  await prisma.document.createMany({ data: documents });
  console.log(`Seeded ${documents.length} legacy documents.`);

  const lessonIds = await seedTaxonomy();
  await seedTaxonomyDocuments(lessonIds);

  await prisma.user.deleteMany();
  for (const user of devUsers) {
    const passwordHash = await hashPassword(user.password);
    await prisma.user.create({
      data: { name: user.name, email: user.email, passwordHash, role: user.role },
    });
  }
  console.log(`Seeded ${devUsers.length} development accounts:`);
  for (const user of devUsers) {
    console.log(`  ${user.email} / ${user.password} (${user.role})`);
  }
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
