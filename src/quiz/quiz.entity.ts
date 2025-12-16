import { Entity, PrimaryGeneratedColumn, Column, OneToMany, OneToOne, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { FileEntity } from '../file/file.entity';
import { User } from '../user/user.entity';

@Entity()
export class Quiz {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    title: string;

    @Column({ default: false })
    isRegeneratedQuiz: boolean;

    @Column({ nullable: true })
    sourceNoteId: string;

    @Column('text', { nullable: true })
    weaknessAnalysis: string;

    @ManyToOne(() => FileEntity, { nullable: true })
    @JoinColumn({ name: 'sourceFileId' })
    sourceFile: FileEntity;

    @CreateDateColumn()
    createdAt: Date;

    @OneToMany(() => Question, (question) => question.quiz, { cascade: true })
    questions: Question[];

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'createdById' })
    createdBy: User | null;
}

@Entity()
export class Question {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    text: string;

    @Column()
    type: string; // '객관식', '주관식', 'OX', '빈칸'

    @Column('simple-json', { nullable: true })
    options: string[]; // 객관식 보기

    @Column()
    answer: string;

    @Column('text')
    explanation: string;

    @Column('text')
    sourceContext: string;

    @ManyToOne(() => Quiz, (quiz) => quiz.questions)
    @JoinColumn({ name: 'quizId' })
    quiz: Quiz;
}

@Entity()
export class QuizResult {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    score: number; // 총점

    @Column()
    totalQuestions: number; // 전체 문항 수

    @Column()
    correctQuestions: number; // 맞은 문항 수

    @CreateDateColumn()
    createdAt: Date;

    @ManyToOne(() => Quiz)
    @JoinColumn({ name: 'quizId' })
    quiz: Quiz;

    @OneToMany(() => UserAnswer, (answer) => answer.quizResult, { cascade: true })
    answers: UserAnswer[];

    @OneToOne('WrongAnswerNote', 'quizResult', { nullable: true })
    wrongAnswerNote: any;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'userId' })
    user: User | null;
}

@Entity()
export class UserAnswer {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    questionId: string; // 어떤 문제에 대한 답인지

    @Column()
    selectedAnswer: string; // 사용자가 고른 답

    @Column()
    isCorrect: boolean; // 정답 여부

    @ManyToOne(() => QuizResult, (result) => result.answers)
    @JoinColumn({ name: 'quizResultId' })
    quizResult: QuizResult;
}
