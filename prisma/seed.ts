import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const documents = [
  {
    title: "Database Final Exam 2025",
    description: "Final exam covering normalization, transactions, and query optimization.",
    subject: "Database",
    documentType: "Exam",
    academicYear: "2024-2025",
  },
  {
    title: "Database Midterm Exam 2024",
    description: "Midterm exam covering relational algebra and ER modeling.",
    subject: "Database",
    documentType: "Exam",
    academicYear: "2023-2024",
  },
  {
    title: "SQL Joins and Indexing Workbook",
    description: "Practice workbook on inner/outer joins and index strategy.",
    subject: "Database",
    documentType: "Lecture Notes",
    academicYear: "2024-2025",
  },
  {
    title: "Data Structures Lecture Notes",
    description: "Lecture notes on arrays, linked lists, trees, and hash tables.",
    subject: "Data Structures",
    documentType: "Lecture Notes",
    academicYear: "2024-2025",
  },
  {
    title: "Graphs and Shortest Paths Practice Set",
    description: "Assignment covering BFS, DFS, and Dijkstra's algorithm.",
    subject: "Data Structures",
    documentType: "Assignment",
    academicYear: "2024-2025",
  },
  {
    title: "Big-O Complexity Cheatsheet",
    description: "Quick reference for common time and space complexity classes.",
    subject: "Data Structures",
    documentType: "Cheatsheet",
    academicYear: "2023-2024",
  },
  {
    title: "Web Development Assignment",
    description: "Build a responsive multi-page site using semantic HTML and CSS.",
    subject: "Web Development",
    documentType: "Assignment",
    academicYear: "2024-2025",
  },
  {
    title: "React Hooks Cheatsheet",
    description: "Quick reference for useState, useEffect, useMemo, and useRef.",
    subject: "Web Development",
    documentType: "Cheatsheet",
    academicYear: "2024-2025",
  },
  {
    title: "Responsive Layout Lecture Notes",
    description: "Notes on flexbox, grid, and mobile-first design.",
    subject: "Web Development",
    documentType: "Lecture Notes",
    academicYear: "2023-2024",
  },
  {
    title: "Computer Networks Cheatsheet",
    description: "Summary of the OSI model, TCP/IP stack, and common protocols.",
    subject: "Computer Networks",
    documentType: "Cheatsheet",
    academicYear: "2024-2025",
  },
  {
    title: "TCP/IP Layer Review Exam",
    description: "Exam covering the transport and network layers in depth.",
    subject: "Computer Networks",
    documentType: "Exam",
    academicYear: "2023-2024",
  },
  {
    title: "Subnetting Assignment",
    description: "Practice problems on IPv4 subnetting and CIDR notation.",
    subject: "Computer Networks",
    documentType: "Assignment",
    academicYear: "2024-2025",
  },
];

async function main() {
  await prisma.document.deleteMany();
  await prisma.document.createMany({ data: documents });
  console.log(`Seeded ${documents.length} documents.`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
