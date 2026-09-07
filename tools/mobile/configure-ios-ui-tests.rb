# Add an acceptance target on the Mac build host without changing the app's runtime.
require 'xcodeproj'
project_path = 'ios/App/App.xcodeproj'
project = Xcodeproj::Project.open(project_path)
app = project.targets.find { |target| target.name == 'App' }
abort 'Casher app target missing' unless app
target = project.targets.find { |item| item.name == 'CasherAcceptance' }
unless target
  target = project.new_target(:ui_test_bundle, 'CasherAcceptance', :ios, '15.0')
  target.add_dependency(app)
  group = project.main_group.new_group('CasherAcceptance', 'CasherAcceptance')
  source = group.new_file('LaunchAcceptance.swift')
  target.source_build_phase.add_file_reference(source)
end
target.build_configurations.each do |configuration|
  configuration.build_settings.merge!({
    'PRODUCT_NAME' => '$(TARGET_NAME)',
    'PRODUCT_BUNDLE_IDENTIFIER' => 'com.trycasher.app.acceptance',
    'SWIFT_VERSION' => '5.0',
    'GENERATE_INFOPLIST_FILE' => 'YES',
    'TEST_TARGET_NAME' => 'App',
    'TARGETED_DEVICE_FAMILY' => '1,2',
    'CODE_SIGNING_ALLOWED' => 'YES',
    'CODE_SIGN_IDENTITY' => '-'
  })
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.configure_with_targets(app, target, :launch_target => true)
scheme.save_as(project_path, 'CasherAcceptance', true)
puts 'Configured the real iOS UI acceptance target.'
