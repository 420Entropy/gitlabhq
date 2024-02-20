# frozen_string_literal: true

require 'spec_helper'

RSpec.describe BlobHelper do
  include TreeHelper
  include FakeBlobHelpers

  describe "#sanitize_svg_data" do
    let(:input_svg_path) { File.join(Rails.root, 'spec', 'fixtures', 'unsanitized.svg') }
    let(:data) { File.read(input_svg_path) }
    let(:expected_svg_path) { File.join(Rails.root, 'spec', 'fixtures', 'sanitized.svg') }
    let(:expected) { File.read(expected_svg_path) }

    it 'retains essential elements' do
      expect(sanitize_svg_data(data)).to eq(expected)
    end
  end

  describe "#edit_blob_button" do
    let(:namespace) { create(:namespace, name: 'gitlab') }
    let(:project) { create(:project, :repository, namespace: namespace) }

    subject(:link) { helper.edit_blob_button(project, 'master', 'README.md') }

    before do
      allow(helper).to receive(:current_user).and_return(nil)
      allow(helper).to receive(:can?).and_return(true)
      allow(helper).to receive(:can_collaborate_with_project?).and_return(true)
    end

    it 'does not render edit button when blob is not text' do
      expect(helper).not_to receive(:blob_text_viewable?)

      # RADME.md is not a valid file.
      button = helper.edit_blob_button(project, 'refs/heads/master', 'RADME.md')

      expect(button).to eq(nil)
    end

    it 'uses the passed blob instead retrieve from repository' do
      blob = project.repository.blob_at('refs/heads/master', 'README.md')

      expect(project.repository).not_to receive(:blob_at)

      helper.edit_blob_button(project, 'refs/heads/master', 'README.md', blob: blob)
    end

    it 'returns a link with the proper route' do
      expect(Capybara.string(link).find_link('Edit')[:href]).to eq("/#{project.full_path}/-/edit/master/README.md")
    end

    it 'returns a link with the passed link_opts on the expected route' do
      link_with_mr = helper.edit_blob_button(project, 'master', 'README.md', link_opts: { mr_id: 10 })

      expect(Capybara.string(link_with_mr).find_link('Edit')[:href]).to eq("/#{project.full_path}/-/edit/master/README.md?mr_id=10")
    end
  end

  describe "#relative_raw_path" do
    let_it_be(:project) { create(:project) }

    before do
      assign(:project, project)
    end

    [
      %w[/file.md /-/raw/main/],
      %w[/test/file.md /-/raw/main/test/],
      %w[/another/test/file.md /-/raw/main/another/test/]
    ].each do |file_path, expected_path|
      it "pointing from '#{file_path}' to '#{expected_path}'" do
        blob = fake_blob(path: file_path)
        assign(:blob, blob)
        assign(:id, "main#{blob.path}")
        assign(:path, blob.path)

        expect(helper.parent_dir_raw_path).to eq "/#{project.full_path}#{expected_path}"
      end
    end
  end

  context 'viewer related' do
    let_it_be(:project) { create(:project, lfs_enabled: true) }

    before do
      allow(Gitlab.config.lfs).to receive(:enabled).and_return(true)
    end

    let(:viewer_class) do
      Class.new(BlobViewer::Base) do
        include BlobViewer::ServerSide

        self.collapse_limit = 1.megabyte
        self.size_limit = 5.megabytes
        self.type = :rich
      end
    end

    let(:viewer) { viewer_class.new(blob) }
    let(:blob) { fake_blob }

    describe '#blob_render_error_reason' do
      context 'for error :too_large' do
        context 'when the blob size is larger than the absolute size limit' do
          let(:blob) { fake_blob(size: 10.megabytes) }

          it 'returns an error message' do
            expect(helper.blob_render_error_reason(viewer)).to eq('it is larger than 5 MiB')
          end
        end

        context 'when the blob size is larger than the size limit' do
          let(:blob) { fake_blob(size: 2.megabytes) }

          it 'returns an error message' do
            expect(helper.blob_render_error_reason(viewer)).to eq('it is larger than 1 MiB')
          end
        end
      end

      context 'for error :server_side_but_stored_externally' do
        let(:blob) { fake_blob(lfs: true) }

        it 'returns an error message' do
          expect(helper.blob_render_error_reason(viewer)).to eq('it is stored in LFS')
        end
      end
    end

    describe '#blob_render_error_options' do
      before do
        assign(:project, project)
        assign(:blob, blob)
        assign(:id, File.join('master', blob.path))

        controller.params[:controller] = 'projects/blob'
        controller.params[:action] = 'show'
        controller.params[:namespace_id] = project.namespace.to_param
        controller.params[:project_id] = project.to_param
        controller.params[:id] = File.join('master', blob.path)
      end

      context 'for error :collapsed' do
        let(:blob) { fake_blob(size: 2.megabytes) }

        it 'includes a "load it anyway" link' do
          expect(helper.blob_render_error_options(viewer)).to include(/load it anyway/)
        end
      end

      context 'for error :too_large' do
        let(:blob) { fake_blob(size: 10.megabytes) }

        it 'does not include a "load it anyway" link' do
          expect(helper.blob_render_error_options(viewer)).not_to include(/load it anyway/)
        end

        context 'when the viewer is rich' do
          context 'the blob is rendered as text' do
            let(:blob) { fake_blob(path: 'file.md', size: 2.megabytes) }

            it 'includes a "view the source" link' do
              expect(helper.blob_render_error_options(viewer)).to include(/view the source/)
            end
          end

          context 'the blob is not rendered as text' do
            let(:blob) { fake_blob(path: 'file.pdf', binary: true, size: 2.megabytes) }

            it 'does not include a "view the source" link' do
              expect(helper.blob_render_error_options(viewer)).not_to include(/view the source/)
            end
          end
        end

        context 'when the viewer is not rich' do
          before do
            viewer_class.type = :simple
          end

          let(:blob) { fake_blob(path: 'file.md', size: 2.megabytes) }

          it 'does not include a "view the source" link' do
            expect(helper.blob_render_error_options(viewer)).not_to include(/view the source/)
          end
        end

        it 'includes a "download it" link' do
          expect(helper.blob_render_error_options(viewer)).to include(/download it/)
        end
      end

      context 'for error :server_side_but_stored_externally' do
        let(:blob) { fake_blob(path: 'file.md', lfs: true) }

        it 'does not include a "load it anyway" link' do
          expect(helper.blob_render_error_options(viewer)).not_to include(/load it anyway/)
        end

        it 'does not include a "view the source" link' do
          expect(helper.blob_render_error_options(viewer)).not_to include(/view the source/)
        end

        it 'includes a "download it" link' do
          expect(helper.blob_render_error_options(viewer)).to include(/download it/)
        end
      end
    end
  end

  describe '#ide_edit_path' do
    let(:project) { create(:project) }
    let(:current_user) { create(:user) }
    let(:can_push_code) { true }

    before do
      allow(helper).to receive(:current_user).and_return(current_user)
      allow(helper).to receive(:can?).and_return(can_push_code)
    end

    around do |example|
      old_script_name = Rails.application.routes.default_url_options[:script_name]
      begin
        example.run
      ensure
        Rails.application.routes.default_url_options[:script_name] = old_script_name
      end
    end

    it 'returns full IDE path' do
      Rails.application.routes.default_url_options[:script_name] = nil

      expect(helper.ide_edit_path(project, "master", "")).to eq("/-/ide/project/#{project.namespace.path}/#{project.path}/edit/master")
    end

    it 'returns full IDE path with second -' do
      Rails.application.routes.default_url_options[:script_name] = nil

      expect(helper.ide_edit_path(project, "testing/slashes", "readme.md")).to eq("/-/ide/project/#{project.namespace.path}/#{project.path}/edit/testing/slashes/-/readme.md")
    end

    it 'returns IDE path without relative_url_root' do
      Rails.application.routes.default_url_options[:script_name] = "/gitlab"

      expect(helper.ide_edit_path(project, "master", "")).to eq("/gitlab/-/ide/project/#{project.namespace.path}/#{project.path}/edit/master")
    end

    it 'escapes special characters' do
      Rails.application.routes.default_url_options[:script_name] = nil

      expect(helper.ide_edit_path(project, "testing/#hashes", "readme.md#test")).to eq("/-/ide/project/#{project.full_path}/edit/testing/%23hashes/-/readme.md%23test")
      expect(helper.ide_edit_path(project, "testing/#hashes", "src#/readme.md#test")).to eq("/-/ide/project/#{project.full_path}/edit/testing/%23hashes/-/src%23/readme.md%23test")
    end

    it 'does not escape "/" character' do
      Rails.application.routes.default_url_options[:script_name] = nil

      expect(helper.ide_edit_path(project, "testing/slashes", "readme.md/")).to eq("/-/ide/project/#{project.namespace.path}/#{project.path}/edit/testing/slashes/-/readme.md/")
    end

    context 'when user is not logged in' do
      let(:current_user) { nil }

      it 'returns IDE path inside the project' do
        expect(helper.ide_edit_path(project, "master", "")).to eq("/-/ide/project/#{project.namespace.path}/#{project.path}/edit/master")
      end
    end

    context 'when user cannot push to the project' do
      let(:can_push_code) { false }

      it "returns IDE path with the user's fork" do
        expect(helper.ide_edit_path(project, "master", "")).to eq("/-/ide/project/#{current_user.namespace.full_path}/#{project.path}/edit/master")
      end
    end
  end

  describe '#ide_merge_request_path' do
    let_it_be(:project) { create(:project, :repository) }
    let_it_be(:merge_request) { create(:merge_request, source_project: project) }

    it 'returns IDE path for the given MR if MR is not merged' do
      expect(helper.ide_merge_request_path(merge_request)).to eq("/-/ide/project/#{project.full_path}/merge_requests/#{merge_request.iid}")
    end

    context 'when the MR comes from a fork' do
      include ProjectForksHelper

      let(:forked_project) { fork_project(project, nil, repository: true) }
      let(:merge_request) { create(:merge_request, source_project: forked_project, target_project: project) }

      it 'returns IDE path for MR in the forked repo with target project included as param' do
        expect(helper.ide_merge_request_path(merge_request)).to eq("/-/ide/project/#{forked_project.full_path}/merge_requests/#{merge_request.iid}?target_project=#{CGI.escape(project.full_path)}")
      end
    end

    context 'when the MR is merged' do
      let(:current_user) { build(:user) }

      let_it_be(:merge_request) { create(:merge_request, :merged, source_project: project, source_branch: 'testing-1', target_branch: 'feature-1') }

      before do
        allow(helper).to receive(:current_user).and_return(current_user)
        allow(helper).to receive(:can?).and_return(true)
      end

      it 'returns default IDE url with master branch' do
        expect(helper.ide_merge_request_path(merge_request)).to eq("/-/ide/project/#{project.full_path}/edit/master")
      end

      it 'includes file path passed' do
        expect(helper.ide_merge_request_path(merge_request, 'README.md')).to eq("/-/ide/project/#{project.full_path}/edit/master/-/README.md")
      end

      context 'when target branch exists' do
        before do
          allow(merge_request).to receive(:target_branch_exists?).and_return(true)
        end

        it 'returns IDE edit url with the target branch' do
          expect(helper.ide_merge_request_path(merge_request)).to eq("/-/ide/project/#{project.full_path}/edit/feature-1")
        end
      end
    end
  end

  describe '#ide_fork_and_edit_path' do
    let_it_be(:project) { create(:project) }
    let_it_be(:user) { create(:user) }

    let(:current_user) { user }

    before do
      allow(helper).to receive(:current_user).and_return(current_user)
      allow(helper).to receive(:can?).and_return(true)
    end

    it 'returns path to fork the repo with a redirect param to the full IDE path' do
      uri = URI(helper.ide_fork_and_edit_path(project, "master", ""))
      params = CGI.unescape(uri.query)

      expect(uri.path).to eq("/#{project.namespace.path}/#{project.path}/-/forks")
      expect(params).to include("continue[to]=/-/ide/project/#{project.namespace.path}/#{project.path}/edit/master")
      expect(params).to include("continue[notice]=#{edit_in_new_fork_notice}")
      expect(params).to include("continue[notice_now]=#{edit_in_new_fork_notice_now}")
      expect(params).to include("namespace_key=#{current_user.namespace.id}")
    end

    it 'does not include notice params with_notice: false' do
      uri = URI(helper.ide_fork_and_edit_path(project, "master", "", with_notice: false))

      expect(uri.path).to eq("/#{project.namespace.path}/#{project.path}/-/forks")
      expect(CGI.unescape(uri.query)).to eq("continue[to]=/-/ide/project/#{project.namespace.path}/#{project.path}/edit/master&namespace_key=#{current_user.namespace.id}")
    end

    context 'when user is not logged in' do
      let(:current_user) { nil }

      it 'returns nil' do
        expect(helper.ide_fork_and_edit_path(project, "master", "")).to be_nil
      end
    end
  end

  describe '#fork_and_edit_path' do
    let_it_be(:project) { create(:project) }
    let_it_be(:user) { create(:user) }

    let(:current_user) { user }

    before do
      allow(helper).to receive(:current_user).and_return(current_user)
      allow(helper).to receive(:can?).and_return(true)
    end

    it 'returns path to fork the repo with a redirect param to the full edit path' do
      uri = URI(helper.fork_and_edit_path(project, "master", ""))
      params = CGI.unescape(uri.query)

      expect(uri.path).to eq("/#{project.namespace.path}/#{project.path}/-/forks")
      expect(params).to include("continue[to]=/#{project.namespace.path}/#{project.path}/-/edit/master/")
      expect(params).to include("namespace_key=#{current_user.namespace.id}")
    end

    context 'when user is not logged in' do
      let(:current_user) { nil }

      it 'returns nil' do
        expect(helper.ide_fork_and_edit_path(project, "master", "")).to be_nil
      end
    end
  end

  describe '#vue_blob_app_data' do
    let(:blob) { fake_blob(path: 'file.md', size: 2.megabytes) }
    let(:project) { build_stubbed(:project) }
    let(:user) { build_stubbed(:user) }
    let(:ref) { 'main' }

    it 'returns data related to blob app' do
      allow(helper).to receive(:current_user).and_return(user)
      assign(:ref, ref)

      expect(helper.vue_blob_app_data(project, blob, ref)).to include({
        blob_path: blob.path,
        project_path: project.full_path,
        resource_id: project.to_global_id,
        user_id: user.to_global_id,
        target_branch: ref,
        original_branch: ref
      })
    end
  end
end
