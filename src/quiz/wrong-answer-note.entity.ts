import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, JoinColumn } from 'typeorm';
import { QuizResult } from './quiz.entity';

@Entity()
export class WrongAnswerNote {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    title: string;

    @ManyToOne(() => QuizResult, { nullable: false })
    @JoinColumn({ name: 'quizResultId' })
    quizResult: QuizResult;

    @OneToMany(() => WrongAnswerItem, (item) => item.note, { cascade: true })
    items: WrongAnswerItem[];

    @CreateDateColumn()
    createdAt: Date;
}

@Entity()
export class WrongAnswerItem {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => WrongAnswerNote, (note) => note.items)
    @JoinColumn({ name: 'noteId' })
    note: WrongAnswerNote;

    @Column()
    questionId: string;

    @Column('text')
    questionText: string;

    @Column()
    userAnswer: string;

    @Column()
    correctAnswer: string;

    @Column('text')
    sourceContext: string;

    @Column('text', { nullable: true })
    explanation: string;

    @Column()
    page: number;

    @CreateDateColumn()
    createdAt: Date;
}
