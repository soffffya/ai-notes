import { CreateNoteDto } from './create-note.dto';
import { UpdateNoteDto } from './update-note.dto';

describe('Notes DTOs', () => {
  it('supports CreateNoteDto shape', () => {
    const dto: CreateNoteDto = {
      title: 'Title',
      content: 'Content',
    };

    expect(dto).toEqual({
      title: 'Title',
      content: 'Content',
    });
  });

  it('supports UpdateNoteDto shape', () => {
    const dto: UpdateNoteDto = {
      title: 'Updated title',
      content: 'Updated content',
      categoryId: 'category-1',
    };

    expect(dto).toEqual({
      title: 'Updated title',
      content: 'Updated content',
      categoryId: 'category-1',
    });
  });
});
