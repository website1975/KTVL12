
import React from 'react';
import { Chapter, Grade } from '../../types';
import { FolderTree, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface ChapterManagerProps {
    chapters: Chapter[];
    onSave: (ch: Chapter) => void;
    onDelete: (id: string) => void;
}

export default function ChapterManager({ chapters, onSave, onDelete }: ChapterManagerProps) {
    const [name, setName] = React.useState('');
    const [grade, setGrade] = React.useState<Grade>('12');

    return (
        <div className="max-w-3xl mx-auto space-y-8 animate-fade-in pb-20">
            <div className="bg-white p-10 rounded-[3rem] border shadow-sm space-y-6">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><FolderTree size={16} className="text-blue-600"/> Tạo chương học</h4>
                <div className="flex flex-col gap-4">
                    <select className="p-4 bg-slate-50 border rounded-2xl text-sm font-bold" value={grade} onChange={e => setGrade(e.target.value as Grade)}><option value="12">Khối 12</option><option value="11">Khối 11</option><option value="10">Khối 10</option></select>
                    <div className="flex gap-3">
                        <input className="flex-1 p-4 bg-slate-50 border rounded-2xl text-sm font-bold uppercase" placeholder="Tên chương..." value={name} onChange={e => setName(e.target.value)} />
                        <button onClick={() => { if(name) { onSave({id: uuidv4(), name, grade, order: chapters.length}); setName(''); } }} className="bg-blue-600 text-white px-8 rounded-2xl font-black text-xs uppercase">Lưu</button>
                    </div>
                </div>
            </div>
            <div className="space-y-4">
                {['12', '11', '10'].map(g => (
                    <div key={g} className="space-y-2">
                        <h5 className="text-[10px] font-black uppercase px-6 text-slate-400">Khối {g}</h5>
                        {chapters.filter(c => c.grade === g).map(c => (
                            <div key={c.id} className="bg-white p-5 px-8 rounded-2xl border flex justify-between items-center group">
                                <span className="font-black text-sm text-slate-700 uppercase">{c.name}</span>
                                <button onClick={() => onDelete(c.id)} className="text-slate-200 hover:text-red-500"><Trash2 size={18}/></button>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
